### Backup and Restore

To backup/restore your application it is enough to manually copy/replace your `pb_data` directory _(for transactional safety make sure that the application is not running)_.

To make things slightly easier, PocketBun v0.16+ comes with builtin backups and restore APIs that could be accessed from the Dashboard ( _Settings_ > _Backups_ ):

![Backups settings screenshot](../assets/upstream/screenshots/backups.png)

Backups can be stored locally (default) or in a S3 compatible storage (\*it is recommended to use a separate bucket only for the backups). The generated backup represents a ZIP archive of your `pb_data` directory, including locally stored uploads but excluding local backups and files stored in S3.

PocketBun creates disk-backed SQLite snapshots before adding them to the ZIP, so large databases are not copied into server memory. In multi-worker mode, backup, restore, and restart are coordinated across the whole application; SQLite writers can continue while a backup is generated. Keep roughly three times the size of `pb_data` free for a worst-case local backup, including the temporary snapshots and archive.

PocketBun preserves storage files deleted while the main database snapshot is created and excludes files written after that boundary. The archive therefore will not omit a local storage file referenced by the main database snapshot, although a change exactly around the boundary can leave a harmless unreferenced file in the archive.

The main and auxiliary database snapshots are each internally consistent but are captured sequentially. If your application needs one atomic boundary across both databases and every file, temporarily stop writes while creating the backup.
