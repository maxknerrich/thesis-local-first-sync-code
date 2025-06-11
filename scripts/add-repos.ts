// scripts/setup-github.ts
// Idempotent GitHub repository setup script with rate limiting
// This script can be run multiple times safely - it will only create missing repositories and issues
import "dotenv/config"; // To load .env file
import {
  validateEnvironment,
  createGraphQLClient,
  createRateLimitState,
  checkRateLimit,
  createRepo,
  addIssuesToRepo,
  getExistingIssues,
  deleteIssue,
  type RateLimitState
} from "./helpers.ts";

const { GITHUB_TOKEN, GITHUB_OWNER } = validateEnvironment();
const graphqlWithAuth = createGraphQLClient(GITHUB_TOKEN);
const rateLimitState = createRateLimitState();

// Helper to clear all issues from a repo
async function clearIssues(repoName: string) {
  const existingIssues = await getExistingIssues(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, 100);
  
  if (existingIssues.length === 0) {
    console.log(`No issues to clear in ${repoName}`);
    return;
  }

  console.log(`Clearing ${existingIssues.length} issues from ${repoName}...`);
  
  for (const issue of existingIssues) {
    await deleteIssue(graphqlWithAuth, rateLimitState, issue.id);
  }
  
  console.log(`Cleared ${existingIssues.length} issues.`);
}

// Main function to orchestrate the setup (idempotent)
async function main() {
  console.log("Starting GitHub setup (idempotent with rate limiting)...");
  console.log("- Creating private repositories (converting public ones if needed)");
  console.log("- Adding missing issues to reach target counts\n");
  
  // Check initial rate limit status
  await checkRateLimit(graphqlWithAuth, rateLimitState);
  
  const reposToCreate = {
    "thesis-test-static-10": 10,
    "thesis-test-static-50": 50,
    "thesis-test-static-250": 250,
    "thesis-test-dynamic-5": 5,
    "thesis-test-dynamic-25": 25,
    "thesis-test-dynamic-125": 125,
  };

  for (const [repoName, issueCount] of Object.entries(reposToCreate)) {
    console.log(`\n--- Processing repository: ${repoName} ---`);
    
    // Check rate limit periodically
    if (rateLimitState.remaining < 100) {
      console.log("Rate limit getting low, checking status...");
      await checkRateLimit(graphqlWithAuth, rateLimitState);
    }
    
    const repositoryId = await createRepo(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName);
    
    // Only add issues if repository was successfully created/found and target count > 0
    if (issueCount > 0 && repositoryId) {
      await addIssuesToRepo(graphqlWithAuth, rateLimitState, GITHUB_OWNER, repoName, repositoryId, issueCount);
    } else if (issueCount === 0) {
      console.log(`Repository ${repoName} configured for dynamic testing (no pre-created issues).`);
    }
  }

  // Final rate limit check
  console.log("\n--- Final rate limit status ---");
  await checkRateLimit(graphqlWithAuth, rateLimitState);

  console.log("\n=== GitHub setup complete! ===");
  console.log("This script is idempotent - running it again will only create missing repositories and issues.");
  console.log("All repositories are ensured to be private (public repos are converted automatically).");
  console.log("Rate limiting is implemented to stay within GitHub's API limits.");
}

main().catch(console.error);
