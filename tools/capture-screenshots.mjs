#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { captureFinalScreenshots } from "./capture-screenshots-impl.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFlag = process.argv.indexOf("--output");
const outputDirectory = path.resolve(
    outputFlag >= 0 ? process.argv[outputFlag + 1] : path.join(root, "build/screenshots"),
);

await captureFinalScreenshots({ outputDirectory });
