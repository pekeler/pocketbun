### Backup and Restore

To backup/restore your application it is enough to manually copy/replace your `pb_data` directory _(for transactional safety make sure that the application is not running)_.

To make things slightly easier, PocketBun v0.16+ comes with builtin backups and restore APIs that could be accessed from the Dashboard ( _Settings_ > _Backups_ ):

![Backups settings screenshot](./assets/upstream/screenshots/backups.png)

Backups can be stored locally (default) or in a S3 compatible storage (\*it is recommended to use a separate bucket only for the backups). The generated backup represents a ZIP archive of your `pb_data` directory, including locally stored uploads but excluding local backups and files stored in S3.

PocketBun creates disk-backed SQLite snapshots before adding them to the ZIP, so large databases are not copied into server memory. In multi-worker mode, backup, restore, and restart are coordinated across the whole application; SQLite writers can continue while a backup is generated. Keep roughly three times the size of `pb_data` free for a worst-case local backup, including the temporary snapshots and archive.

Each database snapshot is internally consistent. Files can change while the archive is being built, however, so a restore can contain an unreferenced upload or omit a newly changed file referenced by the snapshot. If your application needs one atomic database-and-files boundary, temporarily stop writes while creating the backup.
