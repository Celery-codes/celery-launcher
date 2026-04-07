package codes.celery.menu;

public class ModEntry {
    public final String id;
    public final String title;
    public final String filename;
    public final String source;
    public boolean enabled;
    public boolean pendingChange; // toggled in this session

    public ModEntry(String id, String title, String filename, String source, boolean enabled) {
        this.id = id;
        this.title = title;
        this.filename = filename;
        this.source = source;
        this.enabled = enabled;
        this.pendingChange = false;
    }
}
