import { scraperRegistry } from '../core/registry';

import { indeedScraper } from './indeed';
import { linkedInScraper } from './linkedin';
import { naukriScraper } from './naukri';
import { wellfoundScraper } from './wellfound';

let registered = false;

export const registerScrapers = (): void => {
  if (registered) return;
  scraperRegistry.register(linkedInScraper);
  scraperRegistry.register(wellfoundScraper);
  scraperRegistry.register(indeedScraper);
  scraperRegistry.register(naukriScraper);
  registered = true;
};

export { indeedScraper, linkedInScraper, naukriScraper, wellfoundScraper };
