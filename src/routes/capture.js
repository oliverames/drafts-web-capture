const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createDraft, getAllDrafts } = require('../database/db');

// Create a new draft
router.post('/capture', async (req, res) => {
  try {
    const { content, tags, syntax, flagged, useLocation, url, redirect } = req.body;

    // Validate required fields
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Parse tags
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    const tagsString = tagsArray.join(', ');

    // Create draft object
    const draftData = {
      uuid: uuidv4().toUpperCase(),
      content: content.trim(),
      tags: tagsString,
      syntax: syntax || 'Plain Text',
      flagged: flagged ? 1 : 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      created_device: 'Web',
      created_longitude: useLocation ? getCurrentLongitude() : 0.0,
      created_latitude: useLocation ? getCurrentLatitude() : 0.0,
      source_url: url || null
    };

    // Create draft in database
    const createdDraft = await createDraft(draftData);

    // Generate Drafts app URL (for opening in Drafts app if installed)
    const draftsUrl = `drafts://open?uuid=${createdDraft.uuid}`;
    
    // Also generate web URL for our self-hosted draft
    const webUrl = `/drafts/${createdDraft.uuid}`;

    // Handle redirect if specified
    if (redirect === 'back') {
      return res.status(201).json({
        success: true,
        message: 'Draft created successfully',
        draft: {
          id: createdDraft.id,
          uuid: createdDraft.uuid,
          draftsUrl: draftsUrl
        },
        redirect: 'back'
      });
    } else if (redirect === 'close') {
      return res.status(201).json({
        success: true,
        message: 'Draft created successfully',
        draft: {
          id: createdDraft.id,
          uuid: createdDraft.uuid,
          draftsUrl: draftsUrl
        },
        redirect: 'close'
      });
    } else if (redirect === 'url' && url) {
      return res.status(201).json({
        success: true,
        message: 'Draft created successfully',
        draft: {
          id: createdDraft.id,
          uuid: createdDraft.uuid,
          draftsUrl: draftsUrl
        },
        redirect: 'url',
        redirectUrl: url
      });
    }

    res.status(201).json({
      success: true,
      message: 'Draft created successfully',
      draft: {
        id: createdDraft.id,
        uuid: createdDraft.uuid,
        draftsUrl: draftsUrl,
        webUrl: webUrl
      }
    });

  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// Get all drafts
router.get('/drafts', async (req, res) => {
  try {
    const drafts = await getAllDrafts();
    res.json({ success: true, drafts });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Helper functions for location (stub implementations)
function getCurrentLongitude() {
  // In a real implementation, this would use browser geolocation
  // For server-side, we return 0.0 as we can't access browser APIs
  return 0.0;
}

function getCurrentLatitude() {
  // In a real implementation, this would use browser geolocation
  // For server-side, we return 0.0 as we can't access browser APIs
  return 0.0;
}

module.exports = router;