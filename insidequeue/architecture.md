# Queue Architecture

Replace the Inside module with the InsideQueue module. The Downloader module will put its output onto the queue. 
The InsideQueue module will process items from the queue and modify the database.

## Queue Data

The data types to be placed on the queue should be defined in extstats-core package.

## Downloader

Modify functions.ts to rely on dispatch.ts to send data off.
Then change dispatch.ts to use the queue rather than Inside.

## InsideDownload

Retrieve entries from the queue of the types defined above in "Queue Data".
Do the same work with them as Inside currently does.