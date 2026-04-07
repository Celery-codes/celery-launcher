package codes.celery.menu;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import com.mojang.blaze3d.platform.InputConstants;
import org.lwjgl.glfw.GLFW;

public class CeleryMenuMod implements ClientModInitializer {

    public static KeyMapping menuKey;

    // Set by CeleryMenuScreen when waiting for a key press to rebind
    public static KeyMapping listeningForRebind = null;

    @Override
    public void onInitializeClient() {
        menuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.celery_menu.open",
            InputConstants.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            KeyMapping.Category.MISC
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.level == null) return;
            while (menuKey.consumeClick()) {
                client.setScreen(new CeleryMenuScreen(client.screen));
            }
        });
    }
}
