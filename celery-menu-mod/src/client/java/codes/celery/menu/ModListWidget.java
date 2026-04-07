package codes.celery.menu;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.ObjectSelectionList;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;

public class ModListWidget extends ObjectSelectionList<ModListWidget.ModRow> {

    public ModListWidget(Minecraft mc, int width, int height, int y, int itemHeight) {
        super(mc, width, height, y, itemHeight);
    }

    public void populate(List<ModEntry> mods, Consumer<ModEntry> onToggle,
                         Consumer<ModEntry> onSelect,
                         Map<String, Function<Screen, Screen>> configScreens) {
        this.clearEntries();
        for (ModEntry mod : mods) {
            this.addEntry(new ModRow(mod, onToggle, onSelect, configScreens.get(mod.id), this.minecraft));
        }
    }

    @Override
    public int getRowWidth() {
        return this.getWidth() - 12;
    }

    public static class ModRow extends ObjectSelectionList.Entry<ModRow> {

        private final ModEntry mod;
        private final Consumer<ModEntry> onToggle;
        private final Consumer<ModEntry> onSelect;
        private final Function<Screen, Screen> configFactory;
        private final Minecraft mc;

        private int toggleX, toggleY, toggleW, toggleH;

        public ModRow(ModEntry mod, Consumer<ModEntry> onToggle, Consumer<ModEntry> onSelect,
                      Function<Screen, Screen> configFactory, Minecraft mc) {
            this.mod           = mod;
            this.onToggle      = onToggle;
            this.onSelect      = onSelect;
            this.configFactory = configFactory;
            this.mc            = mc;
        }

        @Override
        public void renderContent(GuiGraphics g, int mouseX, int mouseY, boolean hovered, float delta) {
            int left   = this.getX();
            int top    = this.getY();
            int width  = this.getWidth();
            int height = this.getHeight();
            int rowRight = left + width;

            if (hovered) g.fill(left, top, rowRight, top + height, 0x18FFFFFF);
            if (mod.pendingChange) g.fill(left, top, left + 3, top + height, 0xFFF59E0B);

            // Status dot
            int dotColor = mod.enabled ? 0xFF4ADE80 : 0xFF475569;
            int dotMid = top + height / 2;
            g.fill(left + 10 - 3, dotMid - 3, left + 10 + 3, dotMid + 3, dotColor);

            // Name + sub
            int textX = left + 22;
            String title = mod.title.length() > 30 ? mod.title.substring(0, 28) + ".." : mod.title;
            g.drawString(mc.font, title, textX, top + 5, 0xFFE2E8F0, false);
            String sub = mod.source != null ? mod.source : "manual";
            if (mod.pendingChange) sub += "  > " + (mod.enabled ? "disabling" : "enabling") + " on restart";
            if (configFactory != null) sub += "  \u2022 configurable";
            g.drawString(mc.font, sub, textX, top + 15, 0xFF475569, false);

            // Arrow hint (click to expand)
            g.drawString(mc.font, ">", rowRight - 20, top + (height - 8) / 2, 0xFF334155, false);

            // Toggle button
            toggleW = 54; toggleH = 16;
            toggleX = rowRight - toggleW - 22;
            toggleY = top + (height - toggleH) / 2;
            boolean hoverToggle = mouseX >= toggleX && mouseX < toggleX + toggleW
                                && mouseY >= toggleY && mouseY < toggleY + toggleH;
            boolean active = mod.enabled;
            int btnBg  = active ? (hoverToggle ? 0xDD1A3D28 : 0xBB1A3D28) : (hoverToggle ? 0xDD1A1F2E : 0xBB1A1F2E);
            int btnBdr = active ? 0xFF4ADE80 : 0xFF334155;
            g.fill(toggleX, toggleY, toggleX + toggleW, toggleY + toggleH, btnBg);
            g.fill(toggleX,               toggleY,              toggleX + toggleW, toggleY + 1,        btnBdr);
            g.fill(toggleX,               toggleY + toggleH -1, toggleX + toggleW, toggleY + toggleH,  btnBdr);
            g.fill(toggleX,               toggleY,              toggleX + 1,       toggleY + toggleH,   btnBdr);
            g.fill(toggleX + toggleW - 1, toggleY,              toggleX + toggleW, toggleY + toggleH,   btnBdr);
            String label = active ? "Enabled" : "Disabled";
            int labelColor = active ? 0xFF4ADE80 : 0xFF64748B;
            g.drawString(mc.font, label, toggleX + (toggleW - mc.font.width(label)) / 2,
                         toggleY + (toggleH - 8) / 2, labelColor, false);

            g.fill(left + 8, top + height - 1, rowRight - 8, top + height, 0x18FFFFFF);
        }

        @Override
        public boolean mouseClicked(MouseButtonEvent event, boolean bl) {
            int mx = (int) event.x(), my = (int) event.y();
            if (event.button() == 0) {
                // Toggle button click
                if (mx >= toggleX && mx < toggleX + toggleW && my >= toggleY && my < toggleY + toggleH) {
                    mod.enabled = !mod.enabled;
                    mod.pendingChange = !mod.pendingChange;
                    onToggle.accept(mod);
                    return true;
                }
                // Row click → open detail
                if (mx >= this.getX() && mx < this.getX() + this.getWidth()
                        && my >= this.getY() && my < this.getY() + this.getHeight()) {
                    onSelect.accept(mod);
                    return true;
                }
            }
            return false;
        }

        @Override
        public Component getNarration() {
            return Component.literal(mod.title + " - " + (mod.enabled ? "enabled" : "disabled"));
        }
    }
}
