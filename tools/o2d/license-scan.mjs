#!/usr/bin/env node
// SPDX dependency scan for o2d-* packages (phase 1 deliverable, doc 26).
// Static by design: reads each o2d package manifest and checks every
// production dependency against the reviewed allowlist below — no install
// required, so it runs early in CI. Legal boundary work (JUR-1) may replace
// this with a full SBOM scanner later.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reviewed dependencies: name -> expected SPDX license expression.
const ALLOWLIST = {
  zod: 'MIT',
};

const repoRoot = new URL('../..', import.meta.url).pathname;
const packagesDirectory = join(repoRoot, 'packages');

const o2dPackages = readdirSync(packagesDirectory).filter((entry) =>
  entry.startsWith('o2d-'),
);

if (o2dPackages.length === 0) {
  console.error('no o2d-* packages found — scan misconfigured');
  process.exit(1);
}

let failed = false;

for (const packageName of o2dPackages) {
  const manifestPath = join(packagesDirectory, packageName, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const dependencies = Object.keys(manifest.dependencies ?? {});

  console.log(`${packageName}: license=${manifest.license ?? 'MISSING'}`);

  if (manifest.license === undefined) {
    console.error(`  FAIL: package declares no license`);
    failed = true;
  }

  for (const dependency of dependencies) {
    const expected = ALLOWLIST[dependency];

    if (expected === undefined) {
      console.error(
        `  FAIL: dependency "${dependency}" is not in the reviewed allowlist (tools/o2d/license-scan.mjs)`,
      );
      failed = true;
      continue;
    }

    // Verify the installed copy matches the reviewed license when available.
    try {
      const installedManifest = JSON.parse(
        readFileSync(
          join(repoRoot, 'node_modules', dependency, 'package.json'),
          'utf-8',
        ),
      );

      if (installedManifest.license !== expected) {
        console.error(
          `  FAIL: "${dependency}" installed license ${installedManifest.license} != reviewed ${expected}`,
        );
        failed = true;
      } else {
        console.log(`  ok: ${dependency} (${expected})`);
      }
    } catch {
      console.log(`  ok (not installed): ${dependency} (reviewed as ${expected})`);
    }
  }
}

process.exit(failed ? 1 : 0);
