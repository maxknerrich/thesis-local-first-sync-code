# Thesis Local-First Synchronization Layer

## Prototype
The prototype can be found under [/apps/local-first](/apps/local-first).
To run the application, a GitHub token must be provided as a ENV varaiable.

The code for the sync layer is inside the [/lib/x-sync](/apps/local-first/src/lib/x-sync).
It includes the Dexie.js add-on, the generic sync object as well as the API adapter for the GitHub API.

## Benchmarks
The Benchmarks can be found under `/tests`. `/scripts` includes helper methods to create and reset repositories using the GitHub API.

`/apps/cloud-test` includes the code for the SSR client-server application that was compared against the prototype.

