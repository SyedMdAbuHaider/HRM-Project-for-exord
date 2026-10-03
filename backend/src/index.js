import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, config.host, () => {
  console.log(`[Exord HRM API] listening on ${config.host}:${config.port}`);
});