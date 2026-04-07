package codes.celery.menu;

import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.ObjectSelectionList;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.network.chat.Component;

import java.util.List;
import java.util.function.Consumer;

public class KeybindsWidget extends ObjectSelectionList<KeybindsWidget.Row> {

    public KeybindsWidget(Minecraft mc, int width, int height, int y, int itemHeight) {
        super(mc, width, height, y, itemHeight);
    }

    public void populate(List<KeyMapping> mappings, Consumer<KeyMapping> onSelect) {
        this.clearEntries();
        for (KeyMapping km : mappings) {
            this.addEntry(new Row(km, onSelect, this.minecraft));
        }
    }

    @Override
    public int getRowWidth() {
        return this.getWidth() - 12;
    }

    public static class Row extends ObjectSelectionList.Entry<Row> {

        private final KeyMapping km;
        private final Consumer<KeyMapping> onSelect;
        private final Minecraft mc;

        private int btnX, btnY, btnW, btnH;
        private int resetX, resetY, resetW, resetH;

        public Row(KeyMapping km, Consumer<KeyMapping> onSelect, Minecraft mc) {
            this.km   = km;
            this.onSelect = onSelect;
            this.mc   = mc;
        }

        @Override
        public void renderContent(GuiGraphics g, int mouseX, int mouseY, boolean hovered, float delta) {
            int left   = this.getX();
            int top    = this.getY();
            int width  = this.getWidth();
            int height = this.getHeight();

            if (hovered) g.fill(left, top, left + width, top + height, 0x18FFFFFF);

            // Keybind name
            String name = Component.translatable(km.getName()).getString();
            if (name.length() > 28) name = name.substring(0, 26) + "..";
            g.drawString(mc.font, name, left + 10, top + (height - 8) / 2, 0xFFCBD5E1, false);

            // Conflict highlight
            boolean conflict = isConflicting();

            // Key button
            btnW = 80; btnH = 16;
            btnX = left + width - btnW - 36;
            btnY = top  + (height - btnH) / 2;
            boolean hoverBtn = mouseX >= btnX && mouseX < btnX + btnW && mouseY >= btnY && mouseY < btnY + btnH;
            int btnBg  = conflict ? 0xBB3D1A1A : (hoverBtn ? 0xDD1A2B3D : 0xBB1A2B3D);
            int btnBdr = conflict ? 0xFFEF4444 : (hoverBtn ? 0xFF60A5FA : 0xFF334155);
            g.fill(btnX, btnY, btnX + btnW, btnY + btnH, btnBg);
            g.fill(btnX,            btnY,            btnX + btnW, btnY + 1,         btnBdr);
            g.fill(btnX,            btnY + btnH - 1, btnX + btnW, btnY + btnH,      btnBdr);
            g.fill(btnX,            btnY,            btnX + 1,    btnY + btnH,       btnBdr);
            g.fill(btnX + btnW - 1, btnY,            btnX + btnW, btnY + btnH,       btnBdr);

            String keyLabel = km.getTranslatedKeyMessage().getString();
            if (km.isUnbound()) keyLabel = "None";
            if (keyLabel.length() > 10) keyLabel = keyLabel.substring(0, 9) + "..";
            int keyTextColor = conflict ? 0xFFEF4444 : 0xFFE2E8F0;
            int lw = mc.font.width(keyLabel);
            g.drawString(mc.font, keyLabel, btnX + (btnW - lw) / 2, btnY + (btnH - 8) / 2, keyTextColor, false);

            // Reset button
            resetW = 28; resetH = 16;
            resetX = btnX + btnW + 4;
            resetY = btnY;
            boolean isDefault = km.isDefault();
            boolean hoverReset = mouseX >= resetX && mouseX < resetX + resetW && mouseY >= resetY && mouseY < resetY + resetH;
            int rstBg  = isDefault ? 0x221A2B3D : (hoverReset ? 0xDD2D1A1A : 0xBB2D1A1A);
            int rstBdr = isDefault ? 0xFF1E293B  : (hoverReset ? 0xFFEF4444  : 0xFF475569);
            g.fill(resetX, resetY, resetX + resetW, resetY + resetH, rstBg);
            g.fill(resetX,              resetY,              resetX + resetW, resetY + 1,          rstBdr);
            g.fill(resetX,              resetY + resetH - 1, resetX + resetW, resetY + resetH,     rstBdr);
            g.fill(resetX,              resetY,              resetX + 1,      resetY + resetH,      rstBdr);
            g.fill(resetX + resetW - 1, resetY,              resetX + resetW, resetY + resetH,      rstBdr);
            String rstLabel = "Rst";
            int rstLw = mc.font.width(rstLabel);
            g.drawString(mc.font, rstLabel, resetX + (resetW - rstLw) / 2, resetY + (resetH - 8) / 2, isDefault ? 0xFF334155 : 0xFFCB7878, false);

            // Divider
            g.fill(left + 8, top + height - 1, left + width - 8, top + height, 0x18FFFFFF);
        }

        private boolean isConflicting() {
            KeyMapping[] all = Minecraft.getInstance().options.keyMappings;
            for (KeyMapping other : all) {
                if (other != km && !km.isUnbound() && km.same(other)) return true;
            }
            return false;
        }

        @Override
        public boolean mouseClicked(MouseButtonEvent event, boolean bl) {
            int mx = (int) event.x();
            int my = (int) event.y();
            if (event.button() == 0) {
                if (mx >= btnX && mx < btnX + btnW && my >= btnY && my < btnY + btnH) {
                    onSelect.accept(km);
                    return true;
                }
                if (mx >= resetX && mx < resetX + resetW && my >= resetY && my < resetY + resetH) {
                    km.setKey(km.getDefaultKey());
                    KeyMapping.resetMapping();
                    Minecraft.getInstance().options.save();
                    return true;
                }
            }
            return false;
        }

        @Override
        public Component getNarration() {
            return Component.literal(km.getName() + ": " + km.getTranslatedKeyMessage().getString());
        }
    }
}
