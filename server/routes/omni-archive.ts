import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('OmniArchive');

import { Router, Request, Response } from "express";
import { contactsHarvester, fileIndexer, chatCleaner, relationMapper, socialGraph } from "../services/omni-archive";

const router = Router();

router.post("/contacts/harvest", async (req: Request, res: Response) => {
  try {
    const { contacts, deviceId } = req.body;
    if (!contacts || !deviceId) {
      return res.status(400).json({ error: "Missing contacts or deviceId" });
    }
    const result = await contactsHarvester.harvestContacts(contacts, deviceId);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Harvest contacts error");
    res.status(500).json({ error: "Failed to harvest contacts" });
  }
});

router.get("/contacts", async (_req: Request, res: Response) => {
  try {
    const contacts = await contactsHarvester.getAllContacts();
    res.json(contacts);
  } catch (error) {
    logger.error({ err: error }, "Get contacts error");
    res.status(500).json({ error: "Failed to get contacts" });
  }
});

router.get("/contacts/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Missing search query" });
    }
    const contacts = await contactsHarvester.searchContacts(q);
    res.json(contacts);
  } catch (error) {
    logger.error({ err: error }, "Search contacts error");
    res.status(500).json({ error: "Failed to search contacts" });
  }
});

router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const contact = await contactsHarvester.getContact(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json(contact);
  } catch (error) {
    logger.error({ err: error }, "Get contact error");
    res.status(500).json({ error: "Failed to get contact" });
  }
});

router.patch("/contacts/:id/importance", async (req: Request, res: Response) => {
  try {
    const { importance } = req.body;
    await contactsHarvester.updateImportance(req.params.id, importance);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Update importance error");
    res.status(500).json({ error: "Failed to update importance" });
  }
});

router.patch("/contacts/:id/trust", async (req: Request, res: Response) => {
  try {
    const { trustScore } = req.body;
    await contactsHarvester.updateTrustScore(req.params.id, trustScore);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Update trust score error");
    res.status(500).json({ error: "Failed to update trust score" });
  }
});

router.post("/contacts/:id/interaction", async (req: Request, res: Response) => {
  try {
    const { initiatedByMe } = req.body;
    await contactsHarvester.recordInteraction(req.params.id, initiatedByMe);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Record interaction error");
    res.status(500).json({ error: "Failed to record interaction" });
  }
});

router.post("/files/index", async (req: Request, res: Response) => {
  try {
    const file = await fileIndexer.indexFile(req.body);
    res.json(file);
  } catch (error) {
    logger.error({ err: error }, "Index file error");
    res.status(500).json({ error: "Failed to index file" });
  }
});

router.get("/files", async (_req: Request, res: Response) => {
  try {
    const files = await fileIndexer.getRecentFiles(50);
    res.json(files);
  } catch (error) {
    logger.error({ err: error }, "Get files error");
    res.status(500).json({ error: "Failed to get files" });
  }
});

router.get("/files/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Missing search query" });
    }
    const files = await fileIndexer.searchFiles(q);
    res.json(files);
  } catch (error) {
    logger.error({ err: error }, "Search files error");
    res.status(500).json({ error: "Failed to search files" });
  }
});

router.get("/files/:id", async (req: Request, res: Response) => {
  try {
    const file = await fileIndexer.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json(file);
  } catch (error) {
    logger.error({ err: error }, "Get file error");
    res.status(500).json({ error: "Failed to get file" });
  }
});

router.get("/files/category/:category", async (req: Request, res: Response) => {
  try {
    const files = await fileIndexer.getFilesByCategory(req.params.category);
    res.json(files);
  } catch (error) {
    logger.error({ err: error }, "Get files by category error");
    res.status(500).json({ error: "Failed to get files" });
  }
});

router.post("/files/:id/link-contact", async (req: Request, res: Response) => {
  try {
    const { contactId } = req.body;
    await fileIndexer.linkToContact(req.params.id, contactId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Link file to contact error");
    res.status(500).json({ error: "Failed to link file to contact" });
  }
});

router.post("/chats/process", async (req: Request, res: Response) => {
  try {
    const chat = await chatCleaner.processChat(req.body);
    res.json(chat);
  } catch (error) {
    logger.error({ err: error }, "Process chat error");
    res.status(500).json({ error: "Failed to process chat" });
  }
});

router.get("/chats/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Missing search query" });
    }
    const chats = await chatCleaner.searchChats(q);
    res.json(chats);
  } catch (error) {
    logger.error({ err: error }, "Search chats error");
    res.status(500).json({ error: "Failed to search chats" });
  }
});

router.get("/chats/:id", async (req: Request, res: Response) => {
  try {
    const chat = await chatCleaner.getChat(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    res.json(chat);
  } catch (error) {
    logger.error({ err: error }, "Get chat error");
    res.status(500).json({ error: "Failed to get chat" });
  }
});

router.get("/chats/contact/:contactId", async (req: Request, res: Response) => {
  try {
    const chats = await chatCleaner.getChatsByContact(req.params.contactId);
    res.json(chats);
  } catch (error) {
    logger.error({ err: error }, "Get chats by contact error");
    res.status(500).json({ error: "Failed to get chats" });
  }
});

router.get("/commitments/pending", async (_req: Request, res: Response) => {
  try {
    const commitments = await chatCleaner.getPendingCommitments();
    res.json(commitments);
  } catch (error) {
    logger.error({ err: error }, "Get pending commitments error");
    res.status(500).json({ error: "Failed to get commitments" });
  }
});

router.get("/opportunities", async (_req: Request, res: Response) => {
  try {
    const opportunities = await chatCleaner.getRecentOpportunities();
    res.json(opportunities);
  } catch (error) {
    logger.error({ err: error }, "Get opportunities error");
    res.status(500).json({ error: "Failed to get opportunities" });
  }
});

router.post("/relations/link", async (req: Request, res: Response) => {
  try {
    const link = await relationMapper.createLink(req.body);
    res.json(link);
  } catch (error) {
    logger.error({ err: error }, "Create link error");
    res.status(500).json({ error: "Failed to create link" });
  }
});

router.post("/relations/auto-link-file/:fileId", async (req: Request, res: Response) => {
  try {
    const links = await relationMapper.autoLinkFileToContacts(req.params.fileId);
    res.json(links);
  } catch (error) {
    logger.error({ err: error }, "Auto-link file error");
    res.status(500).json({ error: "Failed to auto-link file" });
  }
});

router.post("/relations/auto-link-chat/:chatId", async (req: Request, res: Response) => {
  try {
    const links = await relationMapper.autoLinkChatToContacts(req.params.chatId);
    res.json(links);
  } catch (error) {
    logger.error({ err: error }, "Auto-link chat error");
    res.status(500).json({ error: "Failed to auto-link chat" });
  }
});

router.get("/relations/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const links = await relationMapper.getLinksForEntity(req.params.entityType, req.params.entityId);
    res.json(links);
  } catch (error) {
    logger.error({ err: error }, "Get links error");
    res.status(500).json({ error: "Failed to get links" });
  }
});

router.post("/relations/detect-conflicts/:contactId", async (req: Request, res: Response) => {
  try {
    const conflicts = await relationMapper.detectConflicts(req.params.contactId);
    res.json(conflicts);
  } catch (error) {
    logger.error({ err: error }, "Detect conflicts error");
    res.status(500).json({ error: "Failed to detect conflicts" });
  }
});

router.get("/conflicts", async (_req: Request, res: Response) => {
  try {
    const conflicts = await relationMapper.getUnresolvedConflicts();
    res.json(conflicts);
  } catch (error) {
    logger.error({ err: error }, "Get conflicts error");
    res.status(500).json({ error: "Failed to get conflicts" });
  }
});

router.patch("/conflicts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { reviewedBy } = req.body;
    await relationMapper.resolveConflict(req.params.id, reviewedBy);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Resolve conflict error");
    res.status(500).json({ error: "Failed to resolve conflict" });
  }
});

router.get("/graph", async (_req: Request, res: Response) => {
  try {
    const graph = await socialGraph.getFullGraph();
    res.json(graph);
  } catch (error) {
    logger.error({ err: error }, "Get graph error");
    res.status(500).json({ error: "Failed to get graph" });
  }
});

router.post("/graph/build", async (_req: Request, res: Response) => {
  try {
    const graph = await socialGraph.buildGraphFromContacts();
    res.json(graph);
  } catch (error) {
    logger.error({ err: error }, "Build graph error");
    res.status(500).json({ error: "Failed to build graph" });
  }
});

router.get("/graph/high-influence", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const nodes = await socialGraph.getHighInfluenceNodes(limit);
    res.json(nodes);
  } catch (error) {
    logger.error({ err: error }, "Get high influence nodes error");
    res.status(500).json({ error: "Failed to get nodes" });
  }
});

router.get("/graph/high-risk", async (_req: Request, res: Response) => {
  try {
    const nodes = await socialGraph.getHighRiskNodes();
    res.json(nodes);
  } catch (error) {
    logger.error({ err: error }, "Get high risk nodes error");
    res.status(500).json({ error: "Failed to get nodes" });
  }
});

router.get("/graph/clusters", async (_req: Request, res: Response) => {
  try {
    const clusters = await socialGraph.getClusters();
    const result: Record<string, any[]> = {};
    for (const [key, value] of Array.from(clusters.entries())) {
      result[key] = value;
    }
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Get clusters error");
    res.status(500).json({ error: "Failed to get clusters" });
  }
});

router.patch("/graph/nodes/:id/position", async (req: Request, res: Response) => {
  try {
    const { posX, posY } = req.body;
    await socialGraph.updateNodePosition(req.params.id, posX, posY);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Update node position error");
    res.status(500).json({ error: "Failed to update position" });
  }
});

router.post("/graph/interaction", async (req: Request, res: Response) => {
  try {
    const { sourceContactId, targetContactId } = req.body;
    await socialGraph.recordInteraction(sourceContactId, targetContactId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Record graph interaction error");
    res.status(500).json({ error: "Failed to record interaction" });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Missing search query" });
    }

    const [contacts, files, chats] = await Promise.all([
      contactsHarvester.searchContacts(q),
      fileIndexer.searchFiles(q),
      chatCleaner.searchChats(q)
    ]);

    res.json({
      contacts,
      files,
      chats,
      total: contacts.length + files.length + chats.length
    });
  } catch (error) {
    logger.error({ err: error }, "Global search error");
    res.status(500).json({ error: "Failed to search" });
  }
});

export default router;
