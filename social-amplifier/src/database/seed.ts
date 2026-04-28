import { getDatabase } from './index.js';
import { runMigrations } from './migrations.js';
import { loadConfig } from '../config/index.js';
import { CampaignManager } from '../campaigns/index.js';

const config = loadConfig();
const db = getDatabase(config.databasePath);

console.log('Running migrations...');
runMigrations(db);

const manager = new CampaignManager(db);

console.log('\nSeeding demo data...');

// Create a demo organization
const org = manager.createOrganization({
  name: 'Demo Campaign',
  slug: 'demo-campaign',
  description: 'A demonstration political campaign',
});
console.log(`  ✓ Organization: ${org.name} (${org.id})`);

// Create a GOTV campaign
const campaign = manager.createCampaign({
  org_id: org.id,
  name: 'Get Out The Vote',
  slug: 'gotv',
  description: 'November GOTV push — mobilize supporters to share voter registration and turnout messaging',
});
console.log(`  ✓ Campaign: ${campaign.name} (${campaign.id})`);

// Add content items
const content1 = manager.createContent({
  campaign_id: campaign.id,
  type: 'link',
  title: 'Register to Vote',
  body: 'Every vote matters. Make sure you\'re registered — it takes less than 2 minutes. Share this with friends and family who need to register!',
  link_url: 'https://vote.org/register-to-vote',
  platform_variants: {
    x: { body: 'Make sure you\'re registered to vote! It takes less than 2 min 🗳️ #VoteReady' },
    facebook: { body: 'Are you registered to vote? It takes less than 2 minutes to check and register. Share this so your friends and family don\'t miss out!' },
  },
});
console.log(`  ✓ Content: ${content1.title} (${content1.id})`);

const content2 = manager.createContent({
  campaign_id: campaign.id,
  type: 'text',
  title: 'Election Day Reminder',
  body: 'Election Day is coming up! Make a plan to vote — know your polling place, bring your ID, and tell your neighbors. Together we can make a difference.',
  platform_variants: {
    x: { body: 'Election Day is almost here! Make a plan to vote 🗓️ Know your polling place, bring ID, tell your neighbors. #ElectionDay' },
  },
});
console.log(`  ✓ Content: ${content2.title} (${content2.id})`);

const content3 = manager.createContent({
  campaign_id: campaign.id,
  type: 'link',
  title: 'Donate to Support Our Campaign',
  body: 'Help us reach more voters with a grassroots donation. Every dollar goes directly to voter outreach in key districts.',
  link_url: 'https://example.com/donate',
});
console.log(`  ✓ Content: ${content3.title} (${content3.id})`);

// Create a share toolkit
const toolkit = manager.createToolkit({
  campaign_id: campaign.id,
  name: 'Voter Registration Toolkit',
  slug: 'voter-reg',
  description: 'Share these voter registration resources with your network',
  header_text: '📢 Help spread the word — share these posts!',
  cta_text: 'Share',
  theme_color: '#2563eb',
  platforms: ['facebook', 'x', 'tiktok'],
  content_ids: [content1.id, content2.id, content3.id],
});
console.log(`  ✓ Toolkit: ${toolkit.name} (${toolkit.id})`);

// Activate the campaign
manager.updateCampaignStatus(campaign.id, 'active');
console.log(`  ✓ Campaign activated`);

console.log('\n✅ Seed complete!');
console.log(`\nEmbed code:`);
console.log(`  <div id="sa-toolkit-${toolkit.id}"></div>`);
console.log(`  <script src="${config.baseUrl}/embed/toolkit.js" data-toolkit-id="${toolkit.id}" data-api="${config.baseUrl}" async></script>`);
console.log(`\nAPI endpoints:`);
console.log(`  GET ${config.baseUrl}/api/share/toolkit/${toolkit.id}`);
console.log(`  GET ${config.baseUrl}/api/campaigns/${campaign.id}`);
console.log(`  GET ${config.baseUrl}/api/analytics/campaigns/${campaign.id}/summary`);

db.close();
