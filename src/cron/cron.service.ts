import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import {
  FetcherService,
  GetGithubRepoResponse,
} from '../fetcher/fetcher.service';
import { ObservedReposService } from '../observed-repos/service/observed-repos.service';

@Injectable()
export class CronService {
  constructor(private prisma: PrismaService) {}

  private readonly logger = new Logger(CronService.name);
  private readonly fetchService = new FetcherService();
  private readonly observedRepoService = new ObservedReposService(this.prisma);

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    this.logger.debug('Start fetching all observed repos');
    this.observeRepos();
  }

  async observeRepos() {
    // Step 1: Get all observed repos from db
    const allObservedRepos =
      await this.observedRepoService.getAllObservedRepos();
    this.logger.debug(`Fetched ${allObservedRepos.length} repos`);

    // Step 2: Iterate over all repos & fetch details for each
    allObservedRepos.map(async (repo) => {
      const repoDetails = await this.fetchService.getGithubRepo(
        repo.owner,
        repo.name,
      );
      const data: GetGithubRepoResponse = repoDetails.data;

      // Step 3: Map to local format
      const mappedData = {
        stars: data.stargazers_count,
        openIssues: data.open_issues_count,
        license: data.license.key,
      };

      // Step 4: Update db with new info
      await this.observedRepoService.updateObservedRepo(repo.id, mappedData);
      this.logger.debug(`Updated ${repo.id}`);
    });
  }
}