package codes.celery.menu;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.network.chat.Component;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class CeleryMenuScreen extends Screen {

    // Layout
    private static final int PANEL_W  = 520;
    private static final int PANEL_H  = 360;
    private static final int HEADER_H = 36;
    private static final int TABS_H   = 28;
    private static final int SEARCH_H = 28;
    private static final int FOOTER_H = 32;
    private static final int ITEM_H   = 34;
    private static final int KB_H     = 30;

    // Colors
    private static final int COL_BG     = 0xEA0D110F;
    private static final int COL_HDR    = 0xFF080B09;
    private static final int COL_BDR    = 0x554ADE80;
    private static final int COL_ACCENT = 0xFF4ADE80;
    private static final int COL_TAB    = 0xFF152B1D;
    private static final int COL_TEXT   = 0xFFE2E8F0;
    private static final int COL_SUB    = 0xFF64748B;
    private static final int COL_WARN   = 0xFFF59E0B;

    private static final String[] TAB_LABELS = { "Mods", "Settings" };

    private final Screen parent;

    // --- Mods tab ---
    private List<ModEntry> allMods = new ArrayList<>();
    private List<ModEntry> filteredMods = new ArrayList<>();
    private final List<ModEntry> pendingToggles = new ArrayList<>();
    private Map<String, Function<Screen, Screen>> configScreens = new HashMap<>();
    private ModListWidget modList;
    private EditBox searchBox;
    private ModEntry selectedMod = null;   // null = list view, non-null = detail view
    private KeybindsWidget detailKbWidget;
    private List<KeyMapping> modKeybinds = new ArrayList<>();
    private Button applyRestartBtn;

    // --- Settings tab ---
    private int ramValue = 4;
    private EditBox jvmArgsBox;
    private Button ramMinusBtn, ramPlusBtn;
    private boolean settingsDirty = false;

    // --- Keybind listening ---
    private KeyMapping listeningForRebind = null;

    // --- Shared ---
    private int activeTab = 0;
    private int panelX, panelY;
    private final int[] tabWidths = new int[TAB_LABELS.length];

    public CeleryMenuScreen(Screen parent) {
        super(Component.literal("Celery Menu"));
        this.parent = parent;
    }

    // ─────────────────────────────────────────── Init ──────────────────────────

    @Override
    protected void init() {
        panelX = (this.width  - PANEL_W) / 2;
        panelY = (this.height - PANEL_H) / 2;
        for (int i = 0; i < TAB_LABELS.length; i++) tabWidths[i] = font.width(TAB_LABELS[i]) + 24;
        buildTab();
    }

    private void buildTab() {
        clearWidgets();
        addRenderableWidget(Button.builder(Component.literal("Done"), b -> closeScreen())
                .bounds(panelX + PANEL_W - 58, panelY + PANEL_H - FOOTER_H + 7, 52, 20).build());

        if (activeTab == 0) {
            if (selectedMod != null) buildDetailView();
            else                     buildModsTab();
        } else {
            buildSettingsTab();
        }
    }

    // ─────────────────────────────────────────── Mods list ─────────────────────

    private void buildModsTab() {
        loadMods();
        loadModMenuScreens();

        int searchY = panelY + HEADER_H + TABS_H;
        searchBox = new EditBox(font, panelX + 12, searchY + 6, PANEL_W - 24, 16, Component.literal(""));
        searchBox.setMaxLength(64);
        searchBox.setHint(Component.literal("Search mods..."));
        searchBox.setBordered(true);
        searchBox.setResponder(this::filterMods);
        addRenderableWidget(searchBox);

        int listTop = panelY + HEADER_H + TABS_H + SEARCH_H;
        int listH   = PANEL_H - HEADER_H - TABS_H - SEARCH_H - FOOTER_H;
        modList = new ModListWidget(minecraft, PANEL_W - 4, listH, listTop, ITEM_H);
        modList.setX(panelX + 2);
        addRenderableWidget(modList);
        filterMods("");

        applyRestartBtn = addRenderableWidget(
            Button.builder(Component.literal("Apply & Restart"), b -> applyAndRestart())
                .bounds(panelX + 10, panelY + PANEL_H - FOOTER_H + 7, 110, 20).build());
        applyRestartBtn.active = !pendingToggles.isEmpty();
    }

    private void loadMods() {
        allMods.clear();
        Path celeryDir = FabricLoader.getInstance().getGameDir().resolve(".celery");
        Path modsJson  = celeryDir.resolve("mods.json");
        if (Files.exists(modsJson)) {
            try (Reader r = Files.newBufferedReader(modsJson)) {
                JsonArray arr = new Gson().fromJson(r, JsonArray.class);
                if (arr != null) for (JsonElement el : arr) {
                    JsonObject o = el.getAsJsonObject();
                    String id       = strOr(o, "id",       "unknown");
                    String title    = strOr(o, "title",    id);
                    String filename = strOr(o, "filename", "");
                    String source   = strOr(o, "source",   "manual");
                    boolean enabled = !o.has("enabled") || o.get("enabled").getAsBoolean();
                    allMods.add(new ModEntry(id, title, filename, source, enabled));
                }
            } catch (IOException ignored) {}
        }
        if (allMods.isEmpty()) {
            Path modsDir = FabricLoader.getInstance().getGameDir().resolve("mods");
            if (Files.exists(modsDir)) {
                try (Stream<Path> s = Files.list(modsDir)) {
                    s.forEach(p -> {
                        String name = p.getFileName().toString();
                        boolean en = name.endsWith(".jar"), dis = name.endsWith(".jar.disabled");
                        if (en || dis) {
                            String title = name.replaceAll("\\.(jar|disabled)$","")
                                              .replaceAll("-\\d[\\d.]*$","")
                                              .replace("-"," ").replace("_"," ");
                            allMods.add(new ModEntry(name, title, name, "manual", en));
                        }
                    });
                } catch (IOException ignored) {}
            }
        }
        for (ModEntry mod : allMods) for (ModEntry pt : pendingToggles)
            if (pt.id.equals(mod.id)) { mod.enabled = pt.enabled; mod.pendingChange = true; }
    }

    @SuppressWarnings("unchecked")
    private void loadModMenuScreens() {
        configScreens.clear();
        if (!FabricLoader.getInstance().isModLoaded("modmenu")) return;
        try {
            for (var container : FabricLoader.getInstance().getEntrypointContainers("modmenu", Object.class)) {
                String modId = container.getProvider().getMetadata().getId();
                Object api   = container.getEntrypoint();
                try {
                    Method gf = api.getClass().getMethod("getModConfigScreenFactory");
                    Object factory = gf.invoke(api);
                    if (factory == null) continue;
                    for (Method m : factory.getClass().getMethods()) {
                        if (m.getParameterCount() == 1
                                && Screen.class.isAssignableFrom(m.getParameterTypes()[0])
                                && Screen.class.isAssignableFrom(m.getReturnType())) {
                            m.setAccessible(true);
                            final Method fn = m;
                            configScreens.put(modId, par -> { try { return (Screen) fn.invoke(factory, par); } catch (Exception e) { return null; } });
                            break;
                        }
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    private void filterMods(String query) {
        String q = query.toLowerCase().trim();
        filteredMods = allMods.stream()
                .filter(m -> q.isEmpty() || m.title.toLowerCase().contains(q) || m.filename.toLowerCase().contains(q))
                .collect(Collectors.toList());
        if (modList != null) modList.populate(filteredMods, this::onToggle, this::openDetail, configScreens);
        if (applyRestartBtn != null) applyRestartBtn.active = !pendingToggles.isEmpty();
    }

    private void onToggle(ModEntry mod) {
        pendingToggles.removeIf(p -> p.id.equals(mod.id));
        pendingToggles.add(mod);
        if (applyRestartBtn != null) applyRestartBtn.active = !pendingToggles.isEmpty();
    }

    // ─────────────────────────────────────────── Mod detail ────────────────────

    private void openDetail(ModEntry mod) {
        selectedMod = mod;
        buildTab();
    }

    private void buildDetailView() {
        ModEntry mod = selectedMod;
        modKeybinds = findKeybindsForMod(mod.id);

        // Back button
        addRenderableWidget(Button.builder(Component.literal("< Back"), b -> {
            selectedMod = null; buildTab();
        }).bounds(panelX + 10, panelY + HEADER_H + TABS_H + 6, 56, 18).build());

        // Toggle button (top-right of content area)
        boolean active = mod.enabled;
        addRenderableWidget(Button.builder(
                Component.literal(active ? "Enabled" : "Disabled"), b -> {
                    mod.enabled = !mod.enabled;
                    mod.pendingChange = !mod.pendingChange;
                    onToggle(mod);
                    buildTab(); // refresh button label
                })
                .bounds(panelX + PANEL_W - 80, panelY + HEADER_H + TABS_H + 6, 70, 18)
                .build());

        // Configure button (if ModMenu)
        if (configScreens.containsKey(mod.id)) {
            addRenderableWidget(Button.builder(Component.literal("Configure"), b -> {
                Screen cfg = configScreens.get(mod.id).apply(minecraft.screen);
                if (cfg != null) minecraft.setScreen(cfg);
            }).bounds(panelX + PANEL_W - 160, panelY + HEADER_H + TABS_H + 6, 74, 18).build());
        }

        // Keybinds widget
        int kbTop = panelY + HEADER_H + TABS_H + 32;
        int kbH   = PANEL_H - HEADER_H - TABS_H - 32 - FOOTER_H;
        detailKbWidget = new KeybindsWidget(minecraft, PANEL_W - 4, kbH, kbTop, KB_H);
        detailKbWidget.setX(panelX + 2);
        addRenderableWidget(detailKbWidget);
        detailKbWidget.populate(modKeybinds, this::startRebinding);

        applyRestartBtn = addRenderableWidget(
            Button.builder(Component.literal("Apply & Restart"), b -> applyAndRestart())
                .bounds(panelX + 10, panelY + PANEL_H - FOOTER_H + 7, 110, 20).build());
        applyRestartBtn.active = !pendingToggles.isEmpty();
    }

    /**
     * Find keybinds for a mod.
     * Strategy: build a set of candidate ID strings from both the Celery metadata ID
     * and any loaded Fabric mod whose ID overlaps with it, then match keybind prefixes.
     */
    private List<KeyMapping> findKeybindsForMod(String modId) {
        Set<String> candidates = buildCandidateIds(modId);

        return Arrays.stream(minecraft.options.keyMappings)
                .filter(km -> {
                    String name = km.getName(); // e.g. "key.sodium.zoom"
                    if (!name.startsWith("key.")) return false;
                    String afterKey = name.substring(4);
                    int dot = afterKey.indexOf('.');
                    String prefix = norm(dot < 0 ? afterKey : afterKey.substring(0, dot));
                    return candidates.contains(prefix);
                })
                .collect(Collectors.toList());
    }

    /** Build a set of normalized ID strings that could represent this mod in a keybind name. */
    private Set<String> buildCandidateIds(String modId) {
        String normMod = norm(modId);
        Set<String> candidates = new HashSet<>();
        candidates.add(normMod);

        // Cross-reference all loaded Fabric mod IDs
        for (var mc : FabricLoader.getInstance().getAllMods()) {
            String fabricId = norm(mc.getMetadata().getId());
            // Match if one contains the other, or they share a common root (≥4 chars)
            if (fabricId.equals(normMod)
                    || fabricId.contains(normMod)
                    || normMod.contains(fabricId)
                    || (normMod.length() >= 4 && fabricId.startsWith(normMod.substring(0, Math.min(normMod.length(), fabricId.length()))))
            ) {
                candidates.add(fabricId);
            }
        }
        return candidates;
    }

    private static String norm(String s) {
        return s.replace('-', '_').replace(' ', '_').toLowerCase();
    }

    private void startRebinding(KeyMapping km) { listeningForRebind = km; }

    // ─────────────────────────────────────────── Settings tab ──────────────────

    private void buildSettingsTab() {
        // Load current values from launcher-settings.json
        Path settingsFile = FabricLoader.getInstance().getGameDir().resolve(".celery").resolve("launcher-settings.json");
        if (Files.exists(settingsFile)) {
            try (Reader r = Files.newBufferedReader(settingsFile)) {
                JsonObject obj = new Gson().fromJson(r, JsonObject.class);
                if (obj != null) {
                    if (obj.has("ram")) ramValue = obj.get("ram").getAsInt();
                    String args = obj.has("customJvmArgs") ? obj.get("customJvmArgs").getAsString() : "";
                    // jvmArgsBox will be set below
                    int jvmY = panelY + HEADER_H + TABS_H + 68;
                    jvmArgsBox = new EditBox(font, panelX + 180, jvmY, PANEL_W - 190, 18, Component.literal(""));
                    jvmArgsBox.setMaxLength(256);
                    jvmArgsBox.setValue(args);
                    jvmArgsBox.setHint(Component.literal("e.g. -XX:+UseZGC"));
                    jvmArgsBox.setResponder(v -> settingsDirty = true);
                    addRenderableWidget(jvmArgsBox);
                }
            } catch (IOException ignored) {}
        }
        if (jvmArgsBox == null) {
            int jvmY = panelY + HEADER_H + TABS_H + 68;
            jvmArgsBox = new EditBox(font, panelX + 180, jvmY, PANEL_W - 190, 18, Component.literal(""));
            jvmArgsBox.setMaxLength(256);
            jvmArgsBox.setHint(Component.literal("e.g. -XX:+UseZGC"));
            jvmArgsBox.setResponder(v -> settingsDirty = true);
            addRenderableWidget(jvmArgsBox);
        }

        int ramY = panelY + HEADER_H + TABS_H + 36;
        ramMinusBtn = addRenderableWidget(Button.builder(Component.literal("-"), b -> {
            if (ramValue > 1) { ramValue--; settingsDirty = true; }
        }).bounds(panelX + 180, ramY, 20, 18).build());
        ramPlusBtn = addRenderableWidget(Button.builder(Component.literal("+"), b -> {
            if (ramValue < 32) { ramValue++; settingsDirty = true; }
        }).bounds(panelX + 230, ramY, 20, 18).build());

        // Save & Restart
        addRenderableWidget(Button.builder(Component.literal("Save & Restart"), b -> saveSettingsAndRestart())
                .bounds(panelX + 180, panelY + HEADER_H + TABS_H + 100, 110, 20).build());
    }

    private void saveSettingsAndRestart() {
        Path celeryDir = FabricLoader.getInstance().getGameDir().resolve(".celery");
        try {
            Files.createDirectories(celeryDir);
            JsonObject pending = new JsonObject();
            pending.addProperty("ram", ramValue);
            pending.addProperty("customJvmArgs", jvmArgsBox != null ? jvmArgsBox.getValue() : "");
            try (Writer w = Files.newBufferedWriter(celeryDir.resolve("pending-settings.json"))) {
                new Gson().toJson(pending, w);
            }
            writeRestartFlag();
            minecraft.stop();
        } catch (IOException ignored) {}
    }

    // ─────────────────────────────────────────── Apply & Restart ───────────────

    private void applyAndRestart() {
        savePendingToggles();
        writeRestartFlag();
        minecraft.stop();
    }

    private void savePendingToggles() {
        if (pendingToggles.isEmpty()) return;
        Path celeryDir = FabricLoader.getInstance().getGameDir().resolve(".celery");
        try {
            Files.createDirectories(celeryDir);
            JsonObject root = new JsonObject();
            JsonArray enable = new JsonArray(), disable = new JsonArray();
            for (ModEntry mod : pendingToggles) {
                if (mod.filename != null && !mod.filename.isEmpty()) {
                    if (mod.enabled) enable.add(mod.filename); else disable.add(mod.filename);
                }
            }
            root.add("enable", enable); root.add("disable", disable);
            try (Writer w = Files.newBufferedWriter(celeryDir.resolve("pending-toggles.json"))) {
                new Gson().toJson(root, w);
            }
        } catch (IOException ignored) {}
    }

    private void writeRestartFlag() {
        Path flagFile = FabricLoader.getInstance().getGameDir().resolve(".celery").resolve("restart-requested.json");
        try {
            Files.createDirectories(flagFile.getParent());
            try (Writer w = Files.newBufferedWriter(flagFile)) { w.write("{}"); }
        } catch (IOException ignored) {}
    }

    // ─────────────────────────────────────────── Input ─────────────────────────

    @Override
    public boolean keyPressed(KeyEvent keyEvent) {
        if (listeningForRebind != null) {
            if (keyEvent.key() == 256) listeningForRebind.setKey(InputConstants.UNKNOWN);
            else                       listeningForRebind.setKey(InputConstants.getKey(keyEvent));
            KeyMapping.resetMapping();
            minecraft.options.save();
            listeningForRebind = null;
            return true;
        }
        if (keyEvent.key() == 256 || CeleryMenuMod.menuKey.matches(keyEvent)) {
            if (selectedMod != null) { selectedMod = null; buildTab(); return true; }
            closeScreen();
            return true;
        }
        return super.keyPressed(keyEvent);
    }

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean bl) {
        if (listeningForRebind != null) {
            listeningForRebind.setKey(InputConstants.Type.MOUSE.getOrCreate(event.button()));
            KeyMapping.resetMapping();
            minecraft.options.save();
            listeningForRebind = null;
            return true;
        }
        // Tab clicks (only when not in detail view)
        if (selectedMod == null) {
            int tabY = panelY + HEADER_H, tabX = panelX;
            int mx = (int) event.x(), my = (int) event.y();
            for (int i = 0; i < TAB_LABELS.length; i++) {
                if (mx >= tabX && mx < tabX + tabWidths[i] && my >= tabY && my < tabY + TABS_H) {
                    if (activeTab != i) { activeTab = i; buildTab(); } return true;
                }
                tabX += tabWidths[i];
            }
        }
        return super.mouseClicked(event, bl);
    }

    // ─────────────────────────────────────────── Render ────────────────────────

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        g.fill(0, 0, width, height, 0x88000000);
        g.fill(panelX, panelY, panelX + PANEL_W, panelY + PANEL_H, COL_BG);
        drawBorder(g, panelX, panelY, PANEL_W, PANEL_H, COL_BDR);

        // Header
        g.fill(panelX, panelY, panelX + PANEL_W, panelY + HEADER_H, COL_HDR);
        g.fill(panelX, panelY + HEADER_H - 1, panelX + PANEL_W, panelY + HEADER_H, COL_BDR);
        String title = selectedMod != null ? selectedMod.title : "Celery Menu";
        g.drawString(font, title, panelX + 14, panelY + 14, COL_ACCENT, false);
        String hint = listeningForRebind != null ? "Press any key to bind..." : "Right Shift to close";
        int hintColor = listeningForRebind != null ? COL_WARN : COL_SUB;
        g.drawString(font, hint, panelX + PANEL_W - font.width(hint) - 10, panelY + 14, hintColor, false);

        // Tabs (only in list view)
        if (selectedMod == null) {
            int tabY = panelY + HEADER_H, tabX = panelX;
            for (int i = 0; i < TAB_LABELS.length; i++) {
                boolean active = (i == activeTab);
                int tw = tabWidths[i];
                if (active) {
                    g.fill(tabX, tabY, tabX + tw, tabY + TABS_H, COL_TAB);
                    g.fill(tabX, tabY + TABS_H - 2, tabX + tw, tabY + TABS_H, COL_ACCENT);
                }
                boolean hover = mouseX >= tabX && mouseX < tabX + tw && mouseY >= tabY && mouseY < tabY + TABS_H;
                g.drawString(font, TAB_LABELS[i], tabX + 12, tabY + (TABS_H - 8) / 2,
                             active ? COL_ACCENT : (hover ? 0xFFCBD5E1 : COL_SUB), false);
                tabX += tw;
            }
            g.fill(panelX, panelY + HEADER_H + TABS_H - 1, panelX + PANEL_W, panelY + HEADER_H + TABS_H, 0x33FFFFFF);
        } else {
            // Detail view: separator line below header
            g.fill(panelX, panelY + HEADER_H, panelX + PANEL_W, panelY + HEADER_H + TABS_H, COL_HDR);
            g.fill(panelX, panelY + HEADER_H + TABS_H - 1, panelX + PANEL_W, panelY + HEADER_H + TABS_H, 0x33FFFFFF);
        }

        // Search bg (mods list view only)
        if (activeTab == 0 && selectedMod == null) {
            int sy = panelY + HEADER_H + TABS_H;
            g.fill(panelX + 8, sy + 3, panelX + PANEL_W - 8, sy + SEARCH_H - 3, 0x22FFFFFF);
        }

        // Settings tab static rendering
        if (activeTab == 1 && selectedMod == null) renderSettingsContent(g);

        // Detail: keybinds section header + empty state
        if (selectedMod != null) {
            int kbLabelY = panelY + HEADER_H + TABS_H + 32;
            g.fill(panelX, kbLabelY, panelX + PANEL_W, kbLabelY + 1, 0x22FFFFFF);
            String kbHeader = "KEYBINDS  (" + modKeybinds.size() + ")";
            g.drawString(font, kbHeader, panelX + 10, kbLabelY + 5, COL_SUB, false);
            if (modKeybinds.isEmpty()) {
                String msg = "No keybinds registered for this mod";
                g.drawString(font, msg, panelX + (PANEL_W - font.width(msg)) / 2,
                             panelY + HEADER_H + TABS_H + 80, COL_SUB, false);
            }
        }

        // Footer
        int footerY = panelY + PANEL_H - FOOTER_H;
        g.fill(panelX, footerY, panelX + PANEL_W, panelY + PANEL_H, COL_HDR);
        g.fill(panelX, footerY, panelX + PANEL_W, footerY + 1, 0x22FFFFFF);
        renderFooter(g, footerY);

        super.render(g, mouseX, mouseY, delta);
    }

    private void renderSettingsContent(GuiGraphics g) {
        int startY = panelY + HEADER_H + TABS_H + 16;
        int lx = panelX + 20;
        int labelColor = 0xFFCBD5E1;

        // RAM row
        int ramY = startY + 20;
        g.drawString(font, "RAM Allocation", lx, ramY + 5, labelColor, false);
        String ramLabel = ramValue + " GB";
        g.drawString(font, ramLabel, panelX + 205 - font.width(ramLabel) / 2, ramY + 5, COL_ACCENT, false);

        // JVM args row
        int jvmY = startY + 52;
        g.drawString(font, "Custom JVM Args", lx, jvmY + 5, labelColor, false);
        // EditBox renders itself via super.render

        // Info rows
        Path sf = FabricLoader.getInstance().getGameDir().resolve(".celery").resolve("launcher-settings.json");
        if (Files.exists(sf)) {
            try (Reader r = Files.newBufferedReader(sf)) {
                JsonObject obj = new Gson().fromJson(r, JsonObject.class);
                if (obj != null) {
                    int iy = startY + 130;
                    String[] infoKeys = { "instanceName", "mcVersion", "loader", "javaPath" };
                    String[] infoLabels = { "Instance", "Minecraft", "Loader", "Java" };
                    for (int i = 0; i < infoKeys.length; i++) {
                        if (obj.has(infoKeys[i])) {
                            String val = obj.get(infoKeys[i]).getAsString();
                            if (val.isEmpty() && infoKeys[i].equals("javaPath")) val = "Auto-detected";
                            g.drawString(font, infoLabels[i], lx, iy, COL_SUB, false);
                            g.drawString(font, val, lx + 100, iy, 0xFF94A3B8, false);
                            iy += 14;
                        }
                    }
                }
            } catch (IOException ignored) {}
        }
    }

    private void renderFooter(GuiGraphics g, int footerY) {
        int mid = footerY + (FOOTER_H - 8) / 2;
        if (activeTab == 0) {
            long pending = allMods.stream().filter(m -> m.pendingChange).count();
            if (selectedMod != null) {
                String note = listeningForRebind != null
                        ? "Press key for: " + Component.translatable(listeningForRebind.getName()).getString()
                        : pending > 0 ? pending + " mod change(s) pending" : "Keybind changes apply immediately";
                g.drawString(font, note, panelX + 130, mid, pending > 0 ? COL_WARN : COL_SUB, false);
            } else {
                String note = pending > 0 ? pending + " change(s) pending" : "Click a mod to view keybinds";
                g.drawString(font, note, panelX + 130, mid, pending > 0 ? COL_WARN : COL_SUB, false);
                String cnt = filteredMods.size() + " mod" + (filteredMods.size() != 1 ? "s" : "");
                g.drawString(font, cnt, panelX + PANEL_W - font.width(cnt) - 66, mid, COL_SUB, false);
            }
        } else {
            g.drawString(font, settingsDirty ? "Unsaved changes" : "Launcher settings", panelX + 10, mid, settingsDirty ? COL_WARN : COL_SUB, false);
        }
    }

    // ─────────────────────────────────────────── Helpers ───────────────────────

    private void drawBorder(GuiGraphics g, int x, int y, int w, int h, int color) {
        g.fill(x,     y,     x+w, y+1,   color);
        g.fill(x,     y+h-1, x+w, y+h,   color);
        g.fill(x,     y,     x+1, y+h,   color);
        g.fill(x+w-1, y,     x+w, y+h,   color);
    }

    private static String strOr(JsonObject o, String key, String def) {
        return o.has(key) ? o.get(key).getAsString() : def;
    }

    private void closeScreen() { listeningForRebind = null; minecraft.setScreen(parent); }

    @Override public boolean isPauseScreen() { return false; }
    @Override public void onClose() { closeScreen(); }
}
