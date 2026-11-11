// App-wide state shared between views.
export const state = { config: null, me: null }; // me = { user, profile, unread, pendingForMe }

export const labelOf = (list, id) => {
  const f = (list || []).find((x) => x.id === id);
  return f ? f.label : id || '';
};
export const stageLabel = (id) => labelOf(state.config.stages, id);
export const instrumentLabel = (id) => labelOf(state.config.instruments, id);
export const pipelineLabel = (id) => labelOf(state.config.pipelineStages, id);
export const statusLabel = (id) => labelOf(state.config.proposalStatuses, id);
