import config from './playwright.config';

/**
 * Config used for a local run
 */
config.workers = 2;
config.use!.headless = true;
config.use!.video = 'on';
config.use!.trace = 'on';

export default config;
