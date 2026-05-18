import { BaseSourceScraper } from '../core/base-scraper';
import type {
  RawJob,
  ScrapeDetailInput,
  ScrapeListingInput,
  ScrapeListingResult,
  ScraperContext,
} from '../core/types';

const PAGE_SIZE = 25;

export class LinkedInScraper extends BaseSourceScraper {
  readonly platform = 'LINKEDIN' as const;
  readonly displayName = 'LinkedIn Jobs';
  readonly baseUrl = 'https://www.linkedin.com';
  readonly defaultRateLimitPerMin = 15;

  protected async scrapeListing(
    { page }: ScraperContext,
    input: ScrapeListingInput,
  ): Promise<ScrapeListingResult> {
    const pageNum = input.page ?? 1;
    const start = (pageNum - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
      keywords: input.query ?? '',
      location: input.location ?? '',
      start: String(start),
    });
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const jobUrls = await page.evaluate(() => {
      const out: string[] = [];
      document
        .querySelectorAll<HTMLAnchorElement>('a.base-card__full-link, a.job-card-list__title')
        .forEach((a) => {
          if (a.href) out.push(a.href);
        });
      return Array.from(new Set(out));
    });

    const nextPage = jobUrls.length === PAGE_SIZE && pageNum < input.maxPages ? pageNum + 1 : null;
    return { jobUrls, nextPage, pageNumber: pageNum };
  }

  protected async scrapeDetail(
    { page }: ScraperContext,
    { url }: ScrapeDetailInput,
  ): Promise<RawJob> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page
      .waitForSelector('.top-card-layout__title, h1', { timeout: 10_000 })
      .catch(() => undefined);

    const data = await page.evaluate(() => {
      const text = (sel: string): string | null =>
        document.querySelector(sel)?.textContent?.trim() ?? null;
      const attr = (sel: string, a: string): string | null =>
        document.querySelector(sel)?.getAttribute(a) ?? null;

      const skills = Array.from(
        document.querySelectorAll('.description__job-criteria-text, .job-criteria__text'),
      )
        .map((n) => n.textContent?.trim() ?? '')
        .filter(Boolean);

      return {
        title: text('h1.top-card-layout__title') ?? text('h1'),
        company: text('.topcard__org-name-link') ?? text('a.topcard__org-name-link'),
        location: text('.topcard__flavor--bullet') ?? text('.topcard__flavor'),
        description:
          (document.querySelector('.description__text') as HTMLElement | null)?.innerText?.trim() ??
          null,
        applyUrl:
          attr('a.topcard__link', 'href') ?? attr('a.apply-button', 'href') ?? location.href,
        postedAtText: text('.posted-time-ago__text'),
        salaryText: text('.compensation__salary') ?? text('.salary'),
        skillsText: skills,
        roleCategoryText:
          text('[data-test="job-criteria-list"] li:nth-child(2) .description__job-criteria-text') ??
          null,
        remote: /remote/i.test(text('.topcard__flavor--bullet') ?? ''),
      };
    });

    const externalId = url.match(/-(\d{8,})(?:\/|\?|$)/)?.[1] ?? null;

    if (!data.title) throw new Error('linkedin: missing title');

    return {
      url,
      externalId,
      title: data.title,
      company: data.company ?? 'Unknown',
      location: data.location,
      description: data.description,
      applyUrl: data.applyUrl ?? url,
      postedAtText: data.postedAtText,
      salaryText: data.salaryText,
      skillsText: data.skillsText,
      roleCategoryText: data.roleCategoryText,
      remote: data.remote,
    };
  }
}

export const linkedInScraper = new LinkedInScraper();
