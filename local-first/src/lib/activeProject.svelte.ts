import type { Project } from './schema';

export let activeProject: { value: undefined | Project } = $state({
	value: undefined,
});

export function setActiveProject(project: Project | undefined) {
	activeProject.value = project;
}
