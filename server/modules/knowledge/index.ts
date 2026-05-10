/**
 * 知识库模块 (Knowledge Module)
 */
const knowledgeModules = {
  knowledgeScheduler: () => import('../../services/knowledge-scheduler'),
  improvedKnowledgeSearch: () => import('../../services/improved-knowledge-search'),
  ragKnowledge: () => import('../../services/rag-knowledge'),
  policyHarvester: () => import('../../services/policy-harvester'),
};
export { knowledgeModules };
