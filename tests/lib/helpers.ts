import * as fs from "fs";
import * as path from "path";

export function saveResults(
  appName: string,
  profileName: string,
  useCase: string,
  runIndex: number,
  data: any,
) {
  const dir = path.join(
    process.cwd(),
    "test-results",
    appName,
    profileName.replace(/\s/g, "-"),
    useCase.replace(/[^a-zA-Z0-9]/g, "-"),
  );

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `run-${runIndex}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${filePath}`);
}
