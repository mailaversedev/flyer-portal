# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

### `npm run server`

Starts the Node.js API server from `server.js`.

### `npm run worker`

Starts the flyer job background worker from `worker.js`.

## Heroku background jobs

Flyer jobs are queued in Firestore and should be processed by a dedicated Heroku worker dyno.

### Why not `setImmediate()` in production

`setImmediate()` only defers work within the same Node.js process. On Heroku, web dynos are ephemeral and may restart before background work finishes, so in-process jobs are not reliable for production workloads.

Current behavior:

- production: the web dyno only enqueues flyer jobs
- local or non-production: inline processing is still allowed
- forced inline mode: set `NOTIFICATION_JOB_INLINE_PROCESSING=true`

### Procfile processes

This app now defines:

- `web: node server.js`
- `worker: node worker.js`

### Recommended Heroku setup

1. Deploy the app normally.
2. Scale the worker dyno to at least 1.
3. Keep the web dyno focused on HTTP traffic only.

Example:

- `heroku ps:scale web=1 worker=1`

### Optional worker environment variables

- `NOTIFICATION_WORKER_INTERVAL_MS` - polling interval in milliseconds, default `10000`
- `NOTIFICATION_WORKER_MAX_JOBS` - max queued jobs processed per cycle, default `3`
- `NOTIFICATION_WORKER_CLEANUP_BATCH` - max expired jobs deleted per cycle, default `200`
- `NOTIFICATION_WORKER_CLEANUP_INTERVAL_MS` - how often cleanup runs, default `300000`
- `FLYER_JOB_LEASE_MS` - stale processing lease timeout before a job can be reclaimed, default `600000`
- `FLYER_JOB_REWARD_CONCURRENCY` - max concurrent idempotent reward transactions per worker chunk, default `20`
- `NOTIFICATION_JOB_INLINE_PROCESSING` - set to `true` only if you explicitly want inline execution

### Notes

- The worker handles queued and failed jobs through Firestore-backed retry state.
- Expired flyer job records are cleaned up automatically by the worker.
- If you do not want a long-running worker dyno, Heroku Scheduler can call a protected worker endpoint instead, but a dedicated worker dyno is the more reliable pattern.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
