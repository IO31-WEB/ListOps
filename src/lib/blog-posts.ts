export interface BlogPost {
  slug: string
  title: string
  description: string
  /** ISO YYYY-MM-DD */
  publishedAt: string
  /** ISO YYYY-MM-DD; last meaningful content refresh */
  updated?: string
  readingTime: string
  category: string
  categoryColor: string
  heroEmoji: string
  excerpt: string
  content: BlogSection[]
  cta: { heading: string; subtext: string; buttonText: string }
  relatedSlugs: string[]
}

export interface BlogSection {
  type: 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'blockquote' | 'callout' | 'stat-grid'
  content?: string
  items?: string[]
  stats?: { value: string; label: string }[]
}

// Ordered newest-first: the blog index treats BLOG_POSTS[0] as the featured post.
export const BLOG_POSTS: BlogPost[] = [

  {
    slug: 'commercial-offering-teaser-that-gets-replies',
    title: 'How to Write an Offering Teaser That Gets Broker Replies',
    description: 'What a commercial offering teaser should include, what to hold back, and how to structure it so qualified buyers and brokers actually respond.',
    publishedAt: '2026-10-15',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Commercial',
    categoryColor: 'indigo',
    heroEmoji: '🏢',
    excerpt: 'A good offering teaser gives a qualified reader enough to decide whether to ask for more, without giving away everything. Here is how to structure one that earns a reply.',
    content: [
      {
        type: 'p',
        content: 'An offering teaser that gets replies is short, specific, and honest: it states the asset, the headline facts, and one clear reason to take a call, then makes the next step easy. Its only job is to move a qualified reader to ask for the full package, not to close the sale on one page.',
      },
      {
        type: 'p',
        content: 'Most weak teasers fail in one of two ways. They say too little (“prime opportunity, call for details”) or they dump everything and leave no reason to talk. The fix is to decide, deliberately, what a stranger needs to see to self-qualify.',
      },
      { type: 'h2', content: 'What a Teaser Is For' },
      {
        type: 'p',
        content: 'A teaser sits before the offering memorandum. Readers are busy brokers and investors scanning many deals. They are asking three questions in about ten seconds: is this the right asset type and market, does the size fit my mandate, and is the story credible?',
      },
      { type: 'h2', content: 'The Anatomy of a Strong Teaser' },
      { type: 'h3', content: 'A headline that states the asset' },
      {
        type: 'p',
        content: 'Lead with property type, market, and size, for example “Multi-tenant retail center, [submarket], [rentable square feet].” Clever taglines can follow, but the plain description comes first because that is what the reader filters on.',
      },
      { type: 'h3', content: 'A short investment summary' },
      {
        type: 'p',
        content: 'Two to four sentences on why this asset is worth a look: location strengths, tenancy profile, a value-add angle, or a recent improvement. Keep every statement something you can support from owner records.',
      },
      { type: 'h3', content: 'Headline facts in a scannable list' },
      {
        type: 'ul',
        items: [
          'Property type, address or submarket (see the confidentiality note below)',
          'Building size, lot size, and year built or renovated',
          'Occupancy and tenancy profile in general terms',
          'Lease structure summary, if the owner is comfortable sharing it',
          'Pricing approach: asking price, guidance, or call for offers',
          'Any financial figures, clearly labeled as owner-provided and subject to buyer verification',
        ],
      },
      { type: 'h3', content: 'One call to action' },
      {
        type: 'p',
        content: 'Tell the reader exactly what to do: request the OM, sign the confidentiality agreement, or book a call. Offering three different next steps lowers response. Put your name, direction, and contact details where they cannot be missed.',
      },
      { type: 'h2', content: 'What to Hold Back' },
      {
        type: 'p',
        content: 'Tenant names, rent rolls, and exact addresses are often withheld until a confidentiality agreement is signed. That decision belongs to the owner and your brokerage, so confirm the disclosure level before anything is published or sent.',
      },
      {
        type: 'ul',
        items: [
          'Tenant-level detail and lease expirations by name',
          'Full operating statements and rent rolls',
          'Anything the owner has not approved for distribution',
          'Claims you cannot support, including projections presented as facts',
        ],
      },
      { type: 'h2', content: 'Credibility Checks Before You Send' },
      {
        type: 'ol',
        items: [
          'Have the owner confirm every figure and approve the final text',
          'Label financials as owner-provided and subject to verification',
          'Check that photos and aerials are current and that you have the rights to use them',
          'Confirm your brokerage’s required disclosures and any confidentiality language',
          'Read it as a skeptical investor and cut every adjective you cannot back up',
        ],
      },
      { type: 'h2', content: 'Where to Send It' },
      {
        type: 'p',
        content: 'Match the channel to the audience: a targeted email to brokers and investors who have bought this asset type, a LinkedIn post that links to a teaser page, and direct calls to your top prospects. A single teaser page with a request form also lets you see who is interested and follow up.',
      },
      {
        type: 'h2',
        content: 'Writing One With ListOps',
      },
      {
        type: 'p',
        content: 'On the Commercial plan, ListOps can draft an offering teaser from the property details you enter, alongside a one-pager, OM-style sections, and a teaser microsite with lead capture. You review and edit everything, confirm each figure with the owner, and decide what gets published.',
      },
      {
        type: 'h2',
        content: 'A Sample Structure You Can Adapt',
      },
      {
        type: 'p',
        content: 'Here is a simple skeleton: a one-line asset headline, a three-sentence investment summary, a short facts list, a single call to action, and a footer with confidentiality language and broker details. Fill each part only with information the owner has approved, and keep the whole teaser to one page or one scrollable page.',
      },
      {
        type: 'p',
        content: 'Before sending, ask a colleague who has never seen the property to read it for thirty seconds and tell you what the asset is, how big it is, and what to do next. If they hesitate on any of the three, rewrite that part.',
      },
      {
        type: 'h2',
        content: 'Follow-Up Matters as Much as the Teaser',
      },
      {
        type: 'p',
        content: 'A teaser rarely closes on its own. Plan the next touch before you send: who you will call, what you will offer to send, and when. Track who requested the package, and respond quickly, since an interested buyer who waits days for a reply may move on to another opportunity.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Write the teaser for a skeptical stranger. State the asset plainly, give a few verifiable facts, label owner-provided numbers, and ask for one specific next step.',
      },
    ],
    cta: {
      heading: 'Draft your offering teaser from the property details',
      subtext: 'The ListOps Commercial plan generates a teaser, one-pager, and teaser microsite for you to review, edit, and approve.',
      buttonText: 'Explore ListOps Commercial',
    },
    relatedSlugs: ['commercial-listing-one-pager-anatomy', 'broker-investor-email-sequence-that-isnt-spam'],
  },

  {
    slug: 'commercial-listing-one-pager-anatomy',
    title: 'Commercial Listing One-Pager: What to Include',
    description: 'A section-by-section guide to a commercial listing one-pager: what goes on it, what to leave off, and how to keep it scannable and credible.',
    publishedAt: '2026-10-01',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Commercial',
    categoryColor: 'indigo',
    heroEmoji: '📄',
    excerpt: 'A commercial one-pager should answer a buyer or broker’s first screening questions on a single page. This is the section-by-section layout that does it.',
    content: [
      {
        type: 'p',
        content: 'A commercial listing one-pager is a single page that lets a broker or investor screen a property in under a minute. It should include a clear property description, a hero image, key facts, an investment or opportunity summary, a location snapshot, and one contact path. Everything else belongs in the offering memorandum.',
      },
      {
        type: 'p',
        content: 'The discipline is in the cutting. If a fact does not help someone decide whether to ask for more, it does not belong on the page.',
      },
      { type: 'h2', content: 'The Section-by-Section Layout' },
      { type: 'h3', content: '1. Header: property type, name, and market' },
      {
        type: 'p',
        content: 'Put the asset type and submarket at the top in plain words. Add your brokerage branding and the transaction type (sale, lease, or both). A reader should know what this is before they read anything else.',
      },
      { type: 'h3', content: '2. One strong exterior image' },
      {
        type: 'p',
        content: 'Use a single high-quality hero image, with an aerial or site plan as a secondary visual when it helps explain the property. Crowded photo grids make the page harder to scan.',
      },
      { type: 'h3', content: '3. Key facts block' },
      {
        type: 'ul',
        items: [
          'Property type and address or submarket',
          'Building and lot size, year built or renovated',
          'Zoning or permitted use, if verified',
          'Parking, loading, clear height, or other features that matter for the asset type',
          'Availability: asking price or lease terms, or “call for pricing”',
        ],
      },
      { type: 'h3', content: '4. Investment or opportunity summary' },
      {
        type: 'p',
        content: 'Write three to five short bullet points or a short paragraph on why the property is interesting: location access, tenancy, condition, or upside. For lease listings, describe the space and who it suits.',
      },
      { type: 'h3', content: '5. Financial snapshot (sale listings, when appropriate)' },
      {
        type: 'p',
        content: 'If the owner agrees to share figures such as in-place income or a pricing metric, label them clearly as owner-provided and subject to buyer verification. If you are not sure a number is reliable, leave it off and offer it in the OM under a confidentiality agreement.',
      },
      { type: 'h3', content: '6. Location snapshot' },
      {
        type: 'p',
        content: 'Describe access and surroundings in factual terms: nearby roads, transit, neighboring uses. Avoid unverifiable superlatives like “best corner in town.”',
      },
      { type: 'h3', content: '7. Contact block and next step' },
      {
        type: 'p',
        content: 'Include every listing broker’s name, phone, email, and license information as your state requires. Add a QR code or short link to a page where readers can request the full package.',
      },
      { type: 'h2', content: 'What to Leave Off' },
      {
        type: 'ul',
        items: [
          'Full tenant rosters and rent roll details unless the owner has approved them',
          'Projections or “pro forma” figures that read like promises',
          'Long paragraphs of market commentary',
          'Anything you could not defend if the reader asked for the source',
        ],
      },
      { type: 'h2', content: 'Design Rules That Keep It Readable' },
      {
        type: 'ol',
        items: [
          'One page, front only, readable on a phone as a PDF',
          'A consistent font and color scheme from your brand',
          'Plenty of white space and no more than two typefaces',
          'Labels for every figure, with units',
          'A date or version note so recipients know it is current',
        ],
      },
      { type: 'h2', content: 'Building It in ListOps' },
      {
        type: 'p',
        content: 'The ListOps Commercial plan generates a one-pager from your property details and applies your brand kit, and it can pair the page with OM-style sections and a teaser microsite. You edit the copy, verify the facts with the owner, and approve before anything is shared.',
      },
      {
        type: 'h2',
        content: 'Adapting the One-Pager by Property Type',
      },
      {
        type: 'p',
        content: 'The skeleton stays the same, but the key facts change. A retail listing might emphasize frontage, traffic access, and tenant mix in general terms. An industrial listing might lead with building size, clear height, dock doors, and truck access. Office listings often highlight floor plate, parking, and building amenities. Multifamily pages tend to focus on unit count, unit mix, and condition.',
      },
      {
        type: 'p',
        content: 'Choose three or four facts that matter most to that asset type and put them at the top of the key facts block. Everything else can sit lower on the page or move to the OM.',
      },
      {
        type: 'h2',
        content: 'Sale Versus Lease One-Pagers',
      },
      {
        type: 'p',
        content: 'A sale one-pager speaks to buyers and investors and may include pricing guidance. A lease one-pager speaks to tenants and tenant representatives and focuses on available space, lease terms, and move-in condition. Keep them separate rather than trying to serve both audiences on one page.',
      },
      {
        type: 'callout',
        content: 'Takeaway: A one-pager is a screening tool. Show the asset, the facts, the opportunity, and one next step, and label anything the owner supplied as subject to verification.',
      },
    ],
    cta: {
      heading: 'Turn property details into a branded one-pager',
      subtext: 'The ListOps Commercial plan drafts a one-pager and OM-style sections with your brand kit applied, ready for you to edit and approve.',
      buttonText: 'Explore ListOps Commercial',
    },
    relatedSlugs: ['commercial-offering-teaser-that-gets-replies', 'present-noi-and-cap-rate-honestly'],
  },

  {
    slug: 'linkedin-marketing-for-commercial-brokers',
    title: 'LinkedIn-First Marketing for Commercial Brokers',
    description: 'How commercial brokers can use LinkedIn to market listings: profile setup, post formats, a weekly cadence, and how to turn engagement into conversations.',
    publishedAt: '2026-09-16',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Commercial',
    categoryColor: 'indigo',
    heroEmoji: '💼',
    excerpt: 'For commercial brokers, LinkedIn is where investors, owners, and other brokers already are. Here is how to market a listing there without sounding like an ad.',
    content: [
      {
        type: 'p',
        content: 'Commercial brokers should lead with LinkedIn because their audience, including investors, owners, tenants’ representatives, and peer brokers, is there professionally and expects business content. The approach that works is a clear profile, a few repeatable post formats, and direct follow-up with people who engage.',
      },
      {
        type: 'p',
        content: 'Residential agents often chase broad reach. Commercial deals are different: a small number of the right readers matters more than a big audience.',
      },
      { type: 'h2', content: 'Set Up Your Profile as a Landing Page' },
      {
        type: 'ul',
        items: [
          'A headline that states your specialty and market, not just “Commercial Real Estate Professional”',
          'An About section covering asset types, submarkets, and the kind of clients you serve',
          'A featured link to your current listings or a contact page',
          'A professional photo and a banner that matches your brand',
          'Contact details you actually monitor',
        ],
      },
      { type: 'h2', content: 'Post Formats That Fit Commercial Work' },
      { type: 'h3', content: 'The new-listing announcement' },
      {
        type: 'p',
        content: 'State the asset, the market, and two or three verified facts. Include a visual, such as the hero photo or the first page of the one-pager. Link to a teaser page rather than attaching sensitive documents, and keep the owner’s approval on file for what you share.',
      },
      { type: 'h3', content: 'The market observation' },
      {
        type: 'p',
        content: 'Share something you actually saw: a tour, a tenant request, a change in the submarket. Keep claims modest and drawn from your own experience, and avoid quoting figures you cannot source.',
      },
      { type: 'h3', content: 'The deal or process note' },
      {
        type: 'p',
        content: 'Explain how a deal moved: how you prepared a property for market, what a buyer asked for. Where details are confidential, speak in generalities and get client approval before naming anyone.',
      },
      { type: 'h3', content: 'The question post' },
      {
        type: 'p',
        content: 'Ask peers something specific about a submarket or asset type. Questions prompt comments, which invite you into conversations with the right people.',
      },
      { type: 'h2', content: 'A Simple Weekly Cadence' },
      {
        type: 'ol',
        items: [
          'Monday: a market observation or short process note',
          'Wednesday: the featured listing post with a visual and link',
          'Friday: a question or a short update on activity at the property',
          'Daily, ten minutes: comment thoughtfully on posts from clients, peers, and prospects',
        ],
      },
      { type: 'h2', content: 'Turn Engagement Into Conversations' },
      {
        type: 'p',
        content: 'When someone engages with a listing post, send a short, personal message thanking them and asking whether the asset fits their criteria. Offer the teaser or one-pager and let them respond. Do not paste a template to dozens of people.',
      },
      { type: 'h2', content: 'Keep It Compliant and Professional' },
      {
        type: 'ul',
        items: [
          'Confirm what the owner has approved before posting any detail',
          'Include your brokerage name and any advertising disclosures your state or firm requires',
          'Label owner-provided financials as subject to verification',
          'Check your brokerage’s social media policy',
        ],
      },
      { type: 'h2', content: 'Where ListOps Helps' },
      {
        type: 'p',
        content: 'The ListOps Commercial plan includes LinkedIn-first social content generated from your property details, with the teaser microsite and one-pager to link to. You review and edit every post before it goes out.',
      },
      {
        type: 'h2',
        content: 'Writing Posts That Sound Like a Person',
      },
      {
        type: 'p',
        content: 'Write the way you would explain the property to a colleague over coffee. Lead with the point, use short sentences, and avoid jargon the reader has to decode. A post that opens with the asset type, the market, and one useful fact will usually serve readers better than one that opens with an exclamation.',
      },
      {
        type: 'ul',
        items: [
          'Use one image or one document, not several',
          'Keep the first two lines meaningful, since that is what shows before “see more”',
          'Tag people only when it is relevant and they would expect it',
          'Put links in a way that fits the current behavior of the platform, and test how they display',
          'Reply to comments promptly and by name',
        ],
      },
      {
        type: 'h2',
        content: 'Measuring What Works',
      },
      {
        type: 'p',
        content: 'Track which posts lead to messages, teaser requests, or calls, rather than counting likes. Note the format, the asset type, and the day, and review monthly. A few quality conversations from a post are a better result than a large number of passive impressions.',
      },
      {
        type: 'callout',
        content: 'Takeaway: On LinkedIn, trust beats volume. Post a few useful, accurate updates each week, link to a clean teaser page, and follow up personally with the people who engage.',
      },
    ],
    cta: {
      heading: 'Generate LinkedIn-first listing content',
      subtext: 'ListOps Commercial drafts LinkedIn posts, a teaser, and a one-pager from your property details for you to review and approve.',
      buttonText: 'Explore ListOps Commercial',
    },
    relatedSlugs: ['commercial-offering-teaser-that-gets-replies', 'broker-investor-email-sequence-that-isnt-spam'],
  },

  {
    slug: 'broker-investor-email-sequence-that-isnt-spam',
    title: 'Broker-to-Investor Email Sequences That Don’t Read as Spam',
    description: 'How to structure a four-touch email sequence to brokers and investors that is relevant, compliant, and respectful of the reader’s time.',
    publishedAt: '2026-08-26',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Email Marketing',
    categoryColor: 'rose',
    heroEmoji: '✉️',
    excerpt: 'A four-touch email sequence can work for commercial listings if every message is relevant, specific, and easy to opt out of. Here is the structure.',
    content: [
      {
        type: 'p',
        content: 'An investor email sequence avoids reading as spam when each message is relevant to the recipient’s stated criteria, adds something new, comes from a real person, and offers a clear way to opt out. A short sequence of about four touches, spaced over a few weeks, is usually enough.',
      },
      {
        type: 'p',
        content: 'The goal is a reply or a request for the full package, not volume. Fewer, better-targeted emails to a clean list outperform blasts to everyone you can find.',
      },
      { type: 'h2', content: 'Start With the Right List' },
      {
        type: 'ul',
        items: [
          'Contacts who have a business relationship with you or have asked to hear about deals',
          'Investors and brokers whose known criteria match the asset type and size',
          'Segmented by interest: property type, market, deal size',
          'Maintained: remove bounces and honor unsubscribes immediately',
        ],
      },
      { type: 'h2', content: 'The Four-Touch Structure' },
      { type: 'h3', content: 'Touch 1: The introduction' },
      {
        type: 'p',
        content: 'Short and plain. Name the asset, market, and two verified facts, say why you are sending it to this person, and link to the teaser page or attach the one-pager. One ask only.',
      },
      { type: 'h3', content: 'Touch 2: The added detail (several days later)' },
      {
        type: 'p',
        content: 'Share one thing the first email did not cover: a notable feature of the property, the location, or a recent improvement. Do not repeat the first message with “just following up.”',
      },
      { type: 'h3', content: 'Touch 3: The process update' },
      {
        type: 'p',
        content: 'Tell recipients what is happening: tours scheduled, a call-for-offers date if the owner has set one, or when the full package becomes available. Only state timelines the owner has approved.',
      },
      { type: 'h3', content: 'Touch 4: The courteous close' },
      {
        type: 'p',
        content: 'Acknowledge they may not be interested, offer to keep them on the list for similar opportunities, and make opting out easy. This email often earns a reply because it removes pressure.',
      },
      { type: 'h2', content: 'Writing Tips' },
      {
        type: 'ol',
        items: [
          'Use a subject line that describes the asset, not hype',
          'Keep each email under about 150 words',
          'Write from a named person with a real signature',
          'Put the single call to action in one place',
          'Label owner-provided figures as subject to verification',
        ],
      },
      { type: 'h2', content: 'Sending Compliantly' },
      {
        type: 'p',
        content: 'Commercial email in the United States is generally subject to CAN-SPAM requirements, such as accurate sender information, a clear way to unsubscribe, and honoring opt-outs promptly. Other jurisdictions have their own rules. Confirm current requirements for your situation with your brokerage or counsel.',
      },
      {
        type: 'ul',
        items: [
          'Include your accurate name and business details',
          'Provide a working unsubscribe link and process requests promptly',
          'Authenticate your sending domain so email is delivered reliably',
          'Do not send to purchased lists',
        ],
      },
      { type: 'h2', content: 'How ListOps Fits In' },
      {
        type: 'p',
        content: 'The ListOps Commercial plan drafts a four-touch broker and investor email sequence from your property details, with compliant sending built in. Review each message, confirm the facts with the owner, and approve before anything goes out.',
      },
      {
        type: 'h2',
        content: 'Subject Lines and Preview Text',
      },
      {
        type: 'p',
        content: 'Describe what is inside. A subject like “Multi-tenant retail, [submarket], [size] SF” tells the reader exactly what they will get and lets them filter. Preview text can add a second fact or the next step. Avoid all caps, excessive punctuation, and urgency you cannot justify, which make messages look like spam to both readers and filters.',
      },
      {
        type: 'h2',
        content: 'Measuring and Adjusting',
      },
      {
        type: 'p',
        content: 'Watch replies and requests for the package more than opens, since open tracking can be unreliable. Note which segments respond, and trim the list to those who engage. If someone replies that a property is not a fit, ask what would be, and update your notes. A smaller, well-understood list will serve you better over time than a large, unfocused one.',
      },
      {
        type: 'ul',
        items: [
          'Review bounces and unsubscribes after every send',
          'Pause the sequence for anyone who replies or requests information',
          'Keep a record of how each contact was added to your list',
          'Refresh your list at least a couple of times a year',
        ],
      },
      {
        type: 'callout',
        content: 'Takeaway: Relevance and respect keep an email sequence out of the spam folder. Send four useful touches to the right people, and make leaving the list effortless.',
      },
    ],
    cta: {
      heading: 'Draft a four-touch sequence in minutes',
      subtext: 'ListOps Commercial generates a broker and investor email sequence for you to review, edit, and send with compliant sending.',
      buttonText: 'Explore ListOps Commercial',
    },
    relatedSlugs: ['commercial-offering-teaser-that-gets-replies', 'linkedin-marketing-for-commercial-brokers'],
  },

  {
    slug: 'present-noi-and-cap-rate-honestly',
    title: 'How to Present NOI and Cap Rate Honestly in Marketing',
    description: 'How to show NOI and cap rate in commercial marketing without overstating: labeling, sourcing, definitions, and what to leave for the OM.',
    publishedAt: '2026-08-05',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Commercial',
    categoryColor: 'indigo',
    heroEmoji: '📊',
    excerpt: 'NOI and cap rate are the numbers investors look at first, and the ones most likely to create problems when presented carelessly. Here is how to do it honestly.',
    content: [
      {
        type: 'p',
        content: 'To present NOI and cap rate honestly, state where each number came from, label it as owner-provided and subject to verification when it is, define what is included, and never present projections as current results. When in doubt, leave the figure out of the marketing piece and share it in the full package under a confidentiality agreement.',
      },
      {
        type: 'p',
        content: 'Investors will re-underwrite anything you publish. Numbers that do not hold up damage credibility faster than missing numbers do.',
      },
      { type: 'h2', content: 'Know What the Terms Mean' },
      {
        type: 'ul',
        items: [
          'Net operating income (NOI) is generally income from the property after operating expenses, before debt service and income taxes',
          'Cap rate is generally NOI divided by a price or value, expressed as a percentage',
          'The definitions can differ by property type and by what counts as an operating expense, so state your assumptions',
        ],
      },
      { type: 'h2', content: 'Rules for Honest Presentation' },
      { type: 'h3', content: 'Name the source' },
      {
        type: 'p',
        content: 'Say whether the number comes from the owner’s records, a trailing period, or a rent roll. A line such as “Owner-provided; subject to buyer verification” belongs next to the figure, not hidden in fine print.',
      },
      { type: 'h3', content: 'Separate actual from projected' },
      {
        type: 'p',
        content: 'In-place figures describe what is happening now. A pro forma describes what could happen under assumptions. Label them differently and never let a projected figure sit under an “actual” heading.',
      },
      { type: 'h3', content: 'Say which period and basis' },
      {
        type: 'p',
        content: 'Specify the time period covered and whether income is based on current leases or on a stabilized assumption. A cap rate with no stated basis is hard to interpret.',
      },
      { type: 'h3', content: 'Be consistent everywhere' },
      {
        type: 'p',
        content: 'The figure on the teaser, the one-pager, the email, and the LinkedIn post should match. Keep one source-of-truth sheet and update every piece when it changes.',
      },
      { type: 'h2', content: 'Common Mistakes to Avoid' },
      {
        type: 'ul',
        items: [
          'Showing a cap rate that relies on income the property does not currently produce',
          'Leaving expenses out so NOI looks stronger',
          'Rounding in a way that flatters the number',
          'Using words like “guaranteed” or “risk-free”',
          'Publishing figures the owner has not approved',
        ],
      },
      { type: 'h2', content: 'A Pre-Publish Checklist' },
      {
        type: 'ol',
        items: [
          'Get the underlying statements from the owner and review them yourself',
          'Have the owner confirm the figures in writing',
          'Add the source and verification language next to every number',
          'Check that all marketing pieces match',
          'Ask your broker or counsel if you are unsure about wording or required disclosures',
        ],
      },
      {
        type: 'p',
        content: 'This is general guidance, not legal or financial advice. Your brokerage and counsel set the standard that applies to you.',
      },
      { type: 'h2', content: 'Using ListOps for the Layout' },
      {
        type: 'p',
        content: 'ListOps Commercial helps lay out the teaser, one-pager, and OM-style sections from the details you enter. It does not supply financial data or verify figures, so every number comes from you and the owner and should be checked before approval.',
      },
      {
        type: 'h2',
        content: 'A Worked Layout, Without Numbers',
      },
      {
        type: 'p',
        content: 'On a one-pager, a financial snapshot might read like this: a small table with labeled lines for the period covered, in-place income, operating expenses, and the resulting NOI, followed by a single sentence noting that the figures are owner-provided and subject to buyer verification. If the price is shown, the cap rate is then simply NOI divided by price, labeled with the same period and basis.',
      },
      {
        type: 'p',
        content: 'If the asset is vacant, newly renovated, or being sold on a value-add thesis, in-place numbers may not tell the story. Explain the situation in words and keep any projections clearly separate and labeled as assumptions.',
      },
      {
        type: 'h2',
        content: 'When Someone Challenges a Number',
      },
      {
        type: 'p',
        content: 'Expect questions. Respond with the source document, not a defense. If you find an error, correct it everywhere, tell people who received the earlier version, and note the update date on the new version. Prompt correction preserves trust better than silence.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Credibility beats a flattering number. Source it, label it, define it, and keep it consistent across every piece of marketing.',
      },
    ],
    cta: {
      heading: 'Lay out your offering materials consistently',
      subtext: 'ListOps Commercial drafts the teaser, one-pager, and OM-style sections from your inputs. You supply and verify the numbers.',
      buttonText: 'Explore ListOps Commercial',
    },
    relatedSlugs: ['commercial-listing-one-pager-anatomy', 'commercial-offering-teaser-that-gets-replies'],
  },

  {
    slug: 'open-house-follow-up-system',
    title: 'An Open House Follow-Up System That Works',
    description: 'A simple, repeatable open house follow-up system: capture, same-day thank-you, a short sequence, and notes that help your seller.',
    publishedAt: '2026-07-15',
    updated: '2026-10-26',
    readingTime: '6 min read',
    category: 'Best Practices',
    categoryColor: 'amber',
    heroEmoji: '🚪',
    excerpt: 'Most open house value is lost in the days afterward. A simple follow-up system turns names on a sign-in sheet into conversations and useful seller feedback.',
    content: [
      {
        type: 'p',
        content: 'The best open house follow-up is quick, personal, and useful: capture contact details with permission, send a thank-you the same day, follow up within a few days with something relevant, and report what you learned to the seller. A short, repeatable sequence beats ad hoc effort.',
      },
      {
        type: 'p',
        content: 'The open house itself is the easy part. The follow-up is where most agents lose the thread.',
      },
      { type: 'h2', content: 'Before the Open House: Make Capture Easy' },
      {
        type: 'ul',
        items: [
          'A digital sign-in or a QR code to a short form, plus a paper backup',
          'Ask only for what you need: name, email or phone, and whether they are working with an agent',
          'Add a clear line about how you will contact them and get their consent where required',
          'Include a question or two that helps you follow up, such as timeline or what they are looking for',
        ],
      },
      { type: 'h2', content: 'The Follow-Up Sequence' },
      { type: 'h3', content: 'Same day: the thank-you' },
      {
        type: 'p',
        content: 'Send a brief note thanking visitors for coming, with a link to the listing page. Mention something specific if you spoke with them. Keep it short and friendly.',
      },
      { type: 'h3', content: 'Day 2 or 3: something useful' },
      {
        type: 'p',
        content: 'Send information relevant to what they said they wanted: a neighborhood summary, similar homes you are aware of, or answers to a question they asked. This is where you earn a reply.',
      },
      { type: 'h3', content: 'Day 7: a gentle check-in' },
      {
        type: 'p',
        content: 'Ask whether they have questions, would like a second showing, or want to see other properties. One clear question works better than a general “just checking in.”',
      },
      { type: 'h3', content: 'After that: nurture or let go' },
      {
        type: 'p',
        content: 'Move engaged contacts into your regular buyer follow-up. If someone is not interested or asks to stop, respect that immediately.',
      },
      { type: 'h2', content: 'Calls and Texts: Mind Consent' },
      {
        type: 'p',
        content: 'Rules on marketing calls and texts, including the TCPA in the United States, depend on consent and how you contact people. A sign-in sheet is not automatically consent to marketing texts. Check what your brokerage requires and ask counsel if you are unsure.',
      },
      { type: 'h2', content: 'Close the Loop With the Seller' },
      {
        type: 'p',
        content: 'Within a day or two, send the seller a short summary: number of visitors, any themes in feedback (for example, comments on price, layout, or condition), and what you plan next. Feedback is anecdotal, so present it as such. A steady habit of reporting builds trust and prepares sellers for any adjustment later.',
      },
      { type: 'h2', content: 'Quick Checklist' },
      {
        type: 'ol',
        items: [
          'Prepare a digital capture form and a QR code for the sign',
          'Send the thank-you before the end of the day',
          'Schedule the day 3 and day 7 messages in advance',
          'Log visitor feedback in one place',
          'Send the seller summary within 48 hours',
        ],
      },
      { type: 'h2', content: 'Where ListOps Helps' },
      {
        type: 'p',
        content: 'ListOps generates the listing microsite with lead capture, QR codes for signs and flyers, and follow-up email copy from your listing details, so the pieces are ready before the open house. You review and edit all messages before they go out.',
      },
      {
        type: 'h2',
        content: 'Message Ideas You Can Adapt',
      },
      {
        type: 'ul',
        items: [
          'Thank-you: “Thank you for coming by [address] today. Here is the listing page with photos and details, and I am happy to answer any questions.”',
          'Useful follow-up: “You mentioned you wanted [feature]. Here are a few things I thought you might like to see.”',
          'Check-in: “Would it be helpful to schedule a second showing, or should I send you other homes in the area?”',
        ],
      },
      {
        type: 'p',
        content: 'Edit each to sound like you, and reference something true from the conversation. Generic messages are easy to ignore.',
      },
      {
        type: 'h2',
        content: 'What to Do With Visitors Who Have an Agent',
      },
      {
        type: 'p',
        content: 'If a visitor says they are working with an agent, respect that relationship. Follow your brokerage policy and local rules about contacting represented buyers, and pass along information through their agent when appropriate. A courteous approach builds referrals over time.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Decide the follow-up before the open house starts. Capture with permission, thank the same day, send something useful, and tell your seller what you heard.',
      },
    ],
    cta: {
      heading: 'Have the follow-up ready before the open house',
      subtext: 'ListOps drafts your lead-capture microsite, QR codes, and follow-up email copy from your listing details.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['qr-codes-on-signs-and-flyers', 'seller-reporting-cadence'],
  },

  {
    slug: 'fair-housing-safe-listing-language',
    title: 'Fair Housing-Safe Listing Language: A Practical Guide',
    description: 'How to write listing descriptions and ads that describe the property, not the people, with examples of safer phrasing and a quick review checklist.',
    publishedAt: '2026-06-24',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Copywriting',
    categoryColor: 'green',
    heroEmoji: '⚖️',
    excerpt: 'Fair housing-safe listing copy describes the property and its features, not who should live there. Here are practical habits and examples of safer phrasing.',
    content: [
      {
        type: 'p',
        content: 'Fair housing-safe listing language describes the property and its features rather than the kind of person who should live there. Avoid statements that suggest a preference or limitation based on a protected class, and focus on objective, verifiable details. This guide is general information, not legal advice.',
      },
      {
        type: 'p',
        content: 'Protected classes under federal law include race, color, religion, sex, national origin, disability, and familial status, and state and local laws often add more. Your local MLS, broker, and counsel are the authorities on what applies where you work.',
      },
      { type: 'h2', content: 'The Core Habit: Describe the Home, Not the Buyer' },
      {
        type: 'p',
        content: 'Ask of every phrase: does this describe the property, or does it describe who would want or belong in it? If it is the second, rewrite it.',
      },
      { type: 'h2', content: 'Phrases to Rethink' },
      {
        type: 'ul',
        items: [
          '“Perfect for young professionals” or “ideal for empty nesters” suggests who should buy',
          '“Great for a family” can point to familial status; describe the bedrooms and yard instead',
          '“Exclusive,” “traditional neighborhood,” or similar wording can imply a type of resident',
          '“Walking distance to church” singles out a religion; consider naming amenities neutrally or leaving it out',
          '“Able-bodied” or similar language about physical ability can create disability issues',
        ],
      },
      { type: 'h2', content: 'Safer Ways to Say It' },
      {
        type: 'ol',
        items: [
          'Instead of “great for families,” write “four bedrooms, fenced backyard, and a finished basement”',
          'Instead of “ideal for retirees,” write “primary suite on the main level and low-maintenance landscaping”',
          'Instead of “close to the best schools,” list the facts: “near [named public school],” and consider letting buyers research quality themselves',
          'Instead of a neighborhood “feel” judgment, name specific amenities: parks, trails, shops, transit',
        ],
      },
      { type: 'h2', content: 'Photos and Visuals Matter Too' },
      {
        type: 'ul',
        items: [
          'Be thoughtful about images of people in marketing materials',
          'Describe what a photo shows rather than who might use the space',
          'Use consistent practices across all advertising for a listing',
        ],
      },
      { type: 'h2', content: 'Accessibility Features: Describe Them Factually' },
      {
        type: 'p',
        content: 'Stating objective features, such as a step-free entry or a wide doorway, helps buyers and avoids judgments about people. Describe what exists without implying who it is for.',
      },
      { type: 'h2', content: 'A Quick Review Checklist' },
      {
        type: 'ol',
        items: [
          'Read the copy for any reference to people instead of the property',
          'Check for subjective neighborhood judgments and replace them with facts',
          'Confirm every claim about schools, crime, or demographics is something you should be stating at all, and check local guidance',
          'Run the final version past your broker or compliance contact',
          'Apply the same standard to social posts, emails, flyers, and microsite copy',
        ],
      },
      { type: 'h2', content: 'AI-Drafted Copy Needs Review Too' },
      {
        type: 'p',
        content: 'When you use AI to draft marketing, you remain responsible for what is published. ListOps generates copy from your listing details and is designed to focus on the property, but it is not a compliance review. Read every piece, and use your MLS rules, brokerage policies, and counsel as your standard.',
      },
      {
        type: 'h2',
        content: 'Why This Matters Beyond Compliance',
      },
      {
        type: 'p',
        content: 'Clear, property-focused language also tends to be better marketing. Specific facts such as square footage, finishes, outdoor space, and nearby amenities give every buyer something concrete to evaluate, while vague lifestyle claims give them nothing to check. Writing about the property is both safer and more useful.',
      },
      {
        type: 'h2',
        content: 'Building a Team Habit',
      },
      {
        type: 'ul',
        items: [
          'Keep a short list of phrases your brokerage has flagged and share it with everyone who writes copy',
          'Review a sample of recent listings once a quarter',
          'Use the same review step for social captions and email, not only the MLS description',
          'Keep up with training offered by your MLS, association, or brokerage',
          'When you are unsure, ask before you publish',
        ],
      },
      {
        type: 'p',
        content: 'Rules and guidance change and vary by location. Treat this article as a starting point and rely on your broker, your MLS, and legal counsel for authoritative answers.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Write about the house, not the household. Use objective features, check unfamiliar phrases with your broker or counsel, and apply the same care to every channel.',
      },
    ],
    cta: {
      heading: 'Draft property-focused copy, then review it',
      subtext: 'ListOps generates listing copy for every channel from your listing details. You review and approve everything.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['listing-description-writing-tips', 'ai-real-estate-marketing-guide'],
  },

  {
    slug: 'qr-codes-on-signs-and-flyers',
    title: 'QR Codes on Signs and Flyers: Setup and Measurement',
    description: 'How to use QR codes on yard signs and flyers: where to place them, what they should link to, and how to track which pieces drive visits.',
    publishedAt: '2026-06-03',
    updated: '2026-10-26',
    readingTime: '6 min read',
    category: 'Best Practices',
    categoryColor: 'amber',
    heroEmoji: '🔳',
    excerpt: 'A QR code turns a sign or flyer into a link to your listing page. Done well, it also tells you which print pieces people actually scan.',
    content: [
      {
        type: 'p',
        content: 'A QR code on a sign or flyer works when it is large enough to scan, placed where people can reach it, and points to a fast, mobile-friendly page with one clear action. To measure results, give each placement its own code or tracking parameter so you can compare them.',
      },
      {
        type: 'p',
        content: 'Most failed QR codes fail for ordinary reasons: too small, too far away, or linked to a page that is slow or hard to use on a phone.',
      },
      { type: 'h2', content: 'Where QR Codes Earn Their Place' },
      {
        type: 'ul',
        items: [
          'Yard sign riders and sign panels, where passersby cannot take a paper flyer',
          'Flyers and brochures inside the home',
          'Postcards and door hangers',
          'Window displays and open house signs',
          'Business cards and email signatures for a current listing',
        ],
      },
      { type: 'h2', content: 'Design and Placement Rules' },
      {
        type: 'ol',
        items: [
          'Make it big enough: for a sign, assume people scan from a car window or sidewalk',
          'Keep strong contrast, dark code on a light background, and leave a clear border',
          'Place it where people can safely stop; never expect a driver to scan while driving',
          'Add a short instruction next to it, such as “Scan for photos and details”',
          'Print a short URL under the code as a backup',
          'Test it on at least two phones before printing',
        ],
      },
      { type: 'h2', content: 'Decide What It Links To' },
      {
        type: 'p',
        content: 'Send scanners to a page that loads quickly on mobile, shows the best photos, key facts, and a simple way to request a showing or more information. Avoid pointing them to a generic home page or a long PDF.',
      },
      { type: 'h2', content: 'How to Measure It' },
      { type: 'h3', content: 'One code per placement' },
      {
        type: 'p',
        content: 'Use a different code or tagged link for the yard sign, the flyer, the postcard, and the open house sign. Then each scan source is separable in your analytics or in the lead source of a form submission.',
      },
      { type: 'h3', content: 'Track the actions, not just scans' },
      {
        type: 'ul',
        items: [
          'Scans or page visits from each placement',
          'Form submissions or showing requests',
          'Which placement the person came from, when asked or recorded',
          'Changes over time as you adjust placement or wording',
        ],
      },
      { type: 'h3', content: 'Read the numbers carefully' },
      {
        type: 'p',
        content: 'A small number of scans is not a trend. Treat early numbers as directional, compare similar listings, and change one variable at a time, such as the call-to-action text next to the code.',
      },
      { type: 'h2', content: 'Privacy and Good Practice' },
      {
        type: 'ul',
        items: [
          'Tell people what happens when they submit a form',
          'Collect only the information you need',
          'Follow your brokerage’s and local rules on collecting and using contact data',
        ],
      },
      { type: 'h2', content: 'Using ListOps' },
      {
        type: 'p',
        content: 'ListOps generates QR codes for your listing microsite and places them on flyers and other print materials, and the microsite includes lead capture so inquiries come back to you. Check each printed proof by scanning it before you send it to print.',
      },
      {
        type: 'h2',
        content: 'A Short Print Checklist',
      },
      {
        type: 'ol',
        items: [
          'Print a test copy and scan it from the distance a real viewer would use',
          'Check the code in daylight and in shade',
          'Confirm the link opens quickly on mobile data, not only on Wi-Fi',
          'Place the code on a clean area of the design with nothing overlapping it',
          'Keep a record of which code is on which sign or flyer',
          'Retire or redirect codes when the listing sells so scans do not hit a dead page',
        ],
      },
      {
        type: 'h2',
        content: 'Using the Code Beyond Print',
      },
      {
        type: 'p',
        content: 'The same code can appear on a social post graphic, in an email signature, or on a window display. It also works for open house sign-in: scanning can open a short form that captures a visitor’s details with their permission. Keep each placement tagged so you can compare them.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Make the code big, link it to a fast mobile page, and use a separate code for each placement so you learn what works.',
      },
    ],
    cta: {
      heading: 'Generate QR codes and flyers for your listing',
      subtext: 'ListOps builds a listing microsite with lead capture and QR-coded flyers from your listing details.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['open-house-follow-up-system', 'real-estate-listing-marketing-checklist'],
  },

  {
    slug: 'seller-reporting-cadence',
    title: 'Seller Reporting Cadence That Makes Price Talks Easier',
    description: 'How a regular, factual seller update makes price-adjustment conversations calmer, with a simple cadence and what to include in each report.',
    publishedAt: '2026-05-13',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Business Growth',
    categoryColor: 'amber',
    heroEmoji: '📈',
    excerpt: 'Sellers who hear from you on a steady schedule are better prepared for tough conversations. Here is a reporting cadence and a template for what to include.',
    content: [
      {
        type: 'p',
        content: 'A regular, factual seller report makes a price conversation easier because the seller has already seen the activity, the feedback, and the market context building over time. Aim for a consistent schedule, such as weekly early on, with the same sections each time and plain language about what is and is not working.',
      },
      {
        type: 'p',
        content: 'Price discussions go badly when they arrive as a surprise. A reporting habit turns the conversation into the next step in a story the seller has been following.',
      },
      { type: 'h2', content: 'Why Cadence Matters' },
      {
        type: 'ul',
        items: [
          'Sellers feel informed instead of guessing what you are doing',
          'Patterns in feedback become visible gradually',
          'You set expectations early about how listings progress',
          'Your marketing work is documented and easy to point to',
        ],
      },
      { type: 'h2', content: 'A Simple Cadence' },
      {
        type: 'ol',
        items: [
          'Before launch: agree on the reporting schedule and how the seller wants to receive it',
          'First two to three weeks: a short weekly report',
          'After that: weekly or every other week, depending on activity and the seller’s preference',
          'Any significant event, such as an offer, a notable showing, or market change, gets a same-day call',
          'A scheduled strategy check-in at a set point, agreed in advance, to review the plan together',
        ],
      },
      { type: 'h2', content: 'What to Put in Every Report' },
      { type: 'h3', content: 'Activity' },
      {
        type: 'p',
        content: 'Showings, inquiries, open house traffic, and marketing completed since the last report. Use your own actual counts, and note when numbers are small.',
      },
      { type: 'h3', content: 'Feedback' },
      {
        type: 'p',
        content: 'Summarize what visitors and buyer agents have said, with themes rather than individual quotes. Keep it factual and fair, including comments the seller may not enjoy hearing.',
      },
      { type: 'h3', content: 'Market context' },
      {
        type: 'p',
        content: 'Note comparable activity you are aware of from your MLS and your own research. Cite your sources internally, and avoid presenting guesses as facts.',
      },
      { type: 'h3', content: 'Next steps' },
      {
        type: 'p',
        content: 'State what you will do next week and what you need from the seller, such as staging adjustments, flexible showing windows, or a repair decision.',
      },
      { type: 'h2', content: 'Preparing for the Price Conversation' },
      {
        type: 'ol',
        items: [
          'Set the expectation at the listing appointment that you will review pricing against activity at agreed checkpoints',
          'Bring the report history to the conversation so the discussion is grounded in what has happened',
          'Present options, such as holding, adjusting, or changing presentation, with the likely tradeoffs',
          'Listen first; the seller may have information you do not',
          'Confirm the decision and next steps in writing afterward',
        ],
      },
      {
        type: 'p',
        content: 'Pricing decisions belong to the seller, and your obligations are set by your brokerage and local rules. When commission or contract questions come up, direct the seller to your broker or an attorney.',
      },
      { type: 'h2', content: 'Making Reports Easy to Deliver' },
      {
        type: 'p',
        content: 'ListOps includes a seller report and approval portal, where sellers can see the campaign and approve materials, which keeps everyone looking at the same information. You still add the context and judgment that only you can provide.',
      },
      {
        type: 'h2',
        content: 'A Report You Can Copy',
      },
      {
        type: 'ol',
        items: [
          'Header: property address and reporting period',
          'Activity: showings, inquiries, and open house visitors this period',
          'Marketing completed: what went out and what is scheduled',
          'Feedback themes: what visitors and agents said',
          'Market context: relevant activity you have observed',
          'Next steps: what you will do and what you need from the seller',
        ],
      },
      {
        type: 'p',
        content: 'Keep it to one page. Sellers read short reports consistently and skim long ones.',
      },
      {
        type: 'h2',
        content: 'Tone Matters',
      },
      {
        type: 'p',
        content: 'Be candid but constructive. If feedback is critical, present it as information to act on rather than a verdict on the home or the seller. Avoid blaming the market, the seller, or other agents, and focus on options. A seller who feels respected will engage with the data far more openly.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Report on a schedule, use the same sections each time, and let the pattern of activity and feedback do the work before you ever bring up price.',
      },
    ],
    cta: {
      heading: 'Keep sellers informed and approvals in one place',
      subtext: 'ListOps includes a seller report and approval portal alongside your listing campaign.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['why-real-estate-agents-lose-listings', 'open-house-follow-up-system'],
  },

  {
    slug: 'why-real-estate-agents-lose-listings',
    title: 'Why Agents Lose Listing Appointments (And How to Win)',
    description: 'Why sellers choose a different agent, and how a specific, visible marketing plan can help you win more listing appointments.',
    publishedAt: '2026-04-22',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Business Growth',
    categoryColor: 'amber',
    heroEmoji: '🏆',
    excerpt: 'Sellers usually choose the agent who shows the clearest plan, not necessarily the lowest fee. Show specific marketing, give examples, and explain what happens after they sign.',
    content: [
      {
        type: 'p',
        content: 'Sellers usually choose the agent who shows the clearest plan, not necessarily the lowest fee. You prepared, walked the property, and built the CMA, and still lost to someone else. Often the difference is how visible and specific the marketing plan was.',
      },
      {
        type: 'p',
        content: 'Price matters to some sellers, but many choose the agent they believe will market the home professionally and with a real plan. Sellers choose agents who make them feel like their home — usually their single largest asset — will be marketed professionally, aggressively, and with a real plan.',
      },
      {
        type: 'h2',
        content: 'The Real Reasons Sellers Choose a Different Agent',
      },
      {
        type: 'ul',
        items: [
          'The other agent came in with a specific marketing plan — not vague promises',
          'The other agent\'s presentation materials looked more polished and professional',
          'The seller didn\'t feel a personal connection — the appointment was too transactional',
          'The other agent showed actual examples of their recent marketing in the neighborhood',
          'The seller didn\'t understand the value of what you were offering vs. what it costs',
          'The other agent asked better questions and listened more',
        ],
      },
      {
        type: 'p',
        content: 'Notice what is not at the top of that list: the fee. Fees and commission terms are negotiable and set between you, the seller, and your brokerage. Discuss them transparently and check your broker and local rules on how to present them.',
      },
      {
        type: 'h2',
        content: 'What a Winning Listing Presentation Looks Like',
      },
      {
        type: 'p',
        content: 'The best listing presentations have three things in common: they\'re specific (not generic), they show actual results (not claims), and they walk the seller through exactly what will happen after they sign.',
      },
      {
        type: 'ol',
        items: [
          'Open with a question, not a pitch — "What\'s most important to you about this sale?"',
          'Show your marketing process step by step — Week 1 through closing',
          'Bring actual examples: a social post you wrote for a similar listing, the email template, the microsite',
          'Present your CMA with confidence and context — "Here\'s what the market is telling us"',
          'Address fees openly once they understand the value of the plan',
          'Specify what you\'ll do in Week 1, Week 2, and what happens if no offer in 30 days',
        ],
      },
      {
        type: 'callout',
        content: 'Try this: bring a live example of your campaign to the next listing appointment. Show a microsite, a sample social post, and an email, then walk the seller through the timeline.',
      },
      {
        type: 'h2',
        content: 'The Marketing Proof Problem',
      },
      {
        type: 'p',
        content: 'Most agents claim to do extensive marketing. Most sellers have no way to evaluate those claims. The agents who win consistently are the ones who can show, not tell.',
      },
      {
        type: 'p',
        content: 'Before your next listing appointment, do this: pull up your last three listings and count how many pieces of content you published for each one. How many Facebook posts? How many emails? Did you do a microsite? Did you run TikToks? If the answer is "not many," that\'s your answer for why you\'re losing presentations.',
      },
      {
        type: 'h2',
        content: 'How to Build a Marketing Presentation That Wins',
      },
      {
        type: 'p',
        content: 'Your listing presentation needs a dedicated marketing section that answers the seller\'s unspoken question: "Will this person actually work hard for me?"',
      },
      {
        type: 'ul',
        items: [
          'Show a sample 6-week campaign calendar — week by week, channel by channel',
          'Include examples of actual social posts and emails you\'ve written for real listings',
          'Screenshot or print a microsite you built for a similar property',
          'Show your own results, such as days on market, only if you can back them up from your records',
          'Include a print materials package: postcard, brochure, yard sign rider',
          'If you use professional photography, show before/after examples of how photos change buyer perception',
        ],
      },
      {
        type: 'callout',
        content: 'Takeaway: The listing presentation is your audition. Come with a specific plan, real examples, and a clear timeline.',
      },
    ],
    cta: {
      heading: 'Show sellers a marketing plan, not just promises',
      subtext: 'ListOps drafts a 6-week marketing campaign from listing details and photos. Use it in your presentations to show sellers what you will do.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['real-estate-listing-marketing-checklist', 'listing-description-writing-tips'],
  },

  {
    slug: 'real-estate-email-marketing-guide',
    title: 'Real Estate Email Marketing: The Agent\'s Complete Guide',
    description: 'The five emails every agent needs, subject lines that earn opens, and how to build a clean list and send reliably.',
    publishedAt: '2026-04-08',
    updated: '2026-10-26',
    readingTime: '8 min read',
    category: 'Email Marketing',
    categoryColor: 'rose',
    heroEmoji: '📧',
    excerpt: 'Real estate agents need five core emails: Just Listed, Just Sold, a regular market update, a buyer drip sequence, and an annual check-in. This guide covers each, plus subject lines and list hygiene.',
    content: [
      {
        type: 'p',
        content: 'Real estate agents need five core emails: Just Listed, Just Sold, a regular market update, a buyer drip sequence, and an annual check-in. Email is a channel you own, and it rewards agents who build a system rather than writing each message from scratch.',
      },
      {
        type: 'p',
        content: 'This guide gives you that system. It covers the five email types every agent needs, the subject lines that actually get opened, and how to build a list that generates consistent referrals.',
      },
      {
        type: 'h2',
        content: 'The 5 Email Types Every Agent Needs',
      },
      {
        type: 'h3',
        content: '1. Just Listed',
      },
      {
        type: 'p',
        content: 'Send soon after the listing goes live. This is the single most time-sensitive email in your arsenal. Subject line formula: "[Address] just hit the market — [1 compelling detail]". Keep it short. One CTA: schedule a showing.',
      },
      {
        type: 'h3',
        content: '2. Just Sold',
      },
      {
        type: 'p',
        content: 'Send soon after closing, once your client has agreed to publicity. This is a proof-of-value email that many agents skip. A well-written Just Sold email reminds the people on your list who may be thinking about selling that you get results.',
      },
      {
        type: 'h3',
        content: '3. Market Update',
      },
      {
        type: 'p',
        content: 'Monthly, at minimum. The agents who consistently generate seller leads from their email list are the ones who send monthly market updates with actual data — median price, days on market, list-to-sale ratio. Not generic national news. Your specific market.',
      },
      {
        type: 'h3',
        content: '4. Buyer Drip Sequence',
      },
      {
        type: 'p',
        content: 'A sequence of 5–8 emails sent over 30 days to any new buyer lead. Day 1: introduce yourself and the process. Day 3: the neighborhood guide for their target area. Day 7: financing tips. Day 14: common buyer mistakes. Day 30: "Still looking?" check-in.',
      },
      {
        type: 'h3',
        content: '5. Annual Check-In',
      },
      {
        type: 'p',
        content: 'One email per year to every past client on the anniversary of their closing. A single paragraph, personal tone, not a newsletter. Because they feel personal, these tend to be among the most warmly received emails you send.',
      },
      {
        type: 'h2',
        content: 'Subject Lines That Get Opened',
      },
      {
        type: 'p',
        content: 'Subject lines and send timing do much of the work in getting an email opened. Test a few approaches with your own list and keep what performs.',
      },
      {
        type: 'ul',
        items: [
          'Use the neighborhood name, not the city — "Travis Heights listing" outperforms "Austin listing"',
          'Specific numbers beat vague superlatives — "3BD under $450k in Westlake" beats "Great new listing"',
          'Questions outperform statements for drip emails — "Ready to see it this weekend?"',
          'First-name personalization can help when the list is warm',
          'Never use "FREE" or excessive exclamation points — they trigger spam filters',
        ],
      },
      {
        type: 'h2',
        content: 'Building Your List the Right Way',
      },
      {
        type: 'p',
        content: 'The most valuable email list in real estate isn\'t big — it\'s warm. A few hundred past clients, active leads, and sphere-of-influence contacts who know who you are will usually serve you better than thousands of cold names from a purchased list.',
      },
      {
        type: 'ul',
        items: [
          'Export every past client and transaction into your CRM immediately',
          'Add every open house attendee the same day (paper sign-in to CRM within 24 hours)',
          'Collect email at every professional touchpoint, with clear permission to send',
          'Segment your list: buyers, sellers, investors, past clients, sphere',
          'Never buy lists. Purchased lists hurt deliverability and can create compliance problems',
        ],
      },
      {
        type: 'h2',
        content: 'The Deliverability Problem Nobody Talks About',
      },
      {
        type: 'p',
        content: 'Many agents send listing emails from a personal inbox with no thought for deliverability, and some of those messages land in spam. Use a purpose-built email platform, authenticate your sending domain (SPF, DKIM, DMARC), and include accurate sender details and a working unsubscribe link, as commercial email rules such as CAN-SPAM generally require. Confirm current requirements with your brokerage or counsel.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Build the five-email system once, send to a list that knows you, authenticate your domain, and reuse the system on every listing.',
      },
    ],
    cta: {
      heading: 'Get email drafts for every listing',
      subtext: 'ListOps drafts the Just Listed email, a Still Available email, and a follow-up sequence from your listing details and photos, ready for you to review and edit.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['real-estate-listing-marketing-checklist', 'why-real-estate-agents-lose-listings'],
  },

  {
    slug: 'listing-description-writing-tips',
    title: 'How to Write a Listing Description That Actually Sells the Home',
    description: 'Proven techniques for writing real estate listing descriptions that attract the right buyers, justify the asking price, and stand out in a crowded MLS.',
    publishedAt: '2026-03-18',
    updated: '2026-10-26',
    readingTime: '6 min read',
    category: 'Copywriting',
    categoryColor: 'green',
    heroEmoji: '✍️',
    excerpt: 'A strong listing description opens with a specific hook, leads with the home\'s best feature, weaves in key details, adds neighborhood context, and ends with one clear call to action. Here is how to write one.',
    content: [
      {
        type: 'p',
        content: 'A strong listing description opens with a specific hook, leads with the home\'s best feature, weaves in key details, adds neighborhood context, and ends with one clear call to action. Buyers and their agents often read it before deciding whether to book a showing, so it deserves more than ten minutes.',
      },
      {
        type: 'p',
        content: 'A mediocre description gets skipped. A great one stops the scroll and makes the buyer feel like they\'ve already been inside the home.',
      },
      {
        type: 'h2',
        content: 'The Anatomy of a High-Performing Listing Description',
      },
      {
        type: 'ol',
        items: [
          'Scene-setting hook (2–3 sentences) — make the buyer feel something before you list a single spec',
          'The headline feature — lead with the single biggest selling point, not the address',
          'Key property details woven naturally into the narrative — not as a bullet list',
          'Neighborhood context — walkability, schools, proximity to what buyers in this price range care about',
          'The lifestyle the home enables — "entertain seamlessly" not "open floor plan"',
          'A single clear call-to-action — "Schedule your private showing" or a link to the microsite',
        ],
      },
      {
        type: 'h2',
        content: '7 Phrases That Weaken Listing Descriptions',
      },
      {
        type: 'p',
        content: 'These phrases appear in millions of listings and signal to buyers that the agent didn\'t put any real thought into the description. Stop using them.',
      },
      {
        type: 'ul',
        items: [
          '"Won\'t last long!" — creates anxiety, not desire',
          '"Dream home" — overused to the point of meaninglessness',
          '"Motivated seller" — signals weakness in negotiation before you\'ve started',
          '"Cozy" for a small room — buyers know what it means',
          '"Unique opportunity" — every listing is a unique opportunity',
          '"As-is" in the headline — leads with the negative',
          '"This one has it all" — tells the buyer nothing',
        ],
      },
      {
        type: 'h2',
        content: 'Writing for Different Buyer Types',
      },
      {
        type: 'p',
        content: 'The same property sells to different buyers for completely different reasons. A 4-bedroom in a good school district appeals to a young family differently than it appeals to an investor looking for a long-term rental.',
      },
      {
        type: 'p',
        content: 'The best listing descriptions have a primary tone (usually the most likely buyer) but contain enough specifics to catch the eye of secondary buyer types. Consider writing tone variants for your social content — luxury angle, first-time buyer angle, investor angle — while keeping your MLS description focused.',
      },
      {
        type: 'h2',
        content: 'SEO in Listing Descriptions: What Matters',
      },
      {
        type: 'p',
        content: 'Buyers use Google before they use the MLS. Your listing microsite, your Facebook posts, and any content you publish with the listing address can show up in searches for the neighborhood. This means your listing description language matters beyond Zillow.',
      },
      {
        type: 'ul',
        items: [
          'Include the full neighborhood name, not just the city (e.g., "Travis Heights in Austin" not just "Austin")',
          'Mention nearby landmarks or schools by name only when factual and appropriate (see our Fair Housing language guide)',
          'Include major nearby landmarks, employer hubs, or transit lines',
          'Write a separate SEO meta title and description for your microsite — different from your MLS copy',
          'Don\'t keyword-stuff — write for the buyer first, the algorithm second',
        ],
      },
      {
        type: 'h2',
        content: 'The Length Question',
      },
      {
        type: 'p',
        content: 'MLS descriptions have character limits (usually 1000–2000 characters), but your microsite and social posts don\'t. Use the MLS limit as an editorial constraint: if you can\'t make it compelling in 500 words, you haven\'t found the right angle.',
      },
      {
        type: 'p',
        content: 'For social media, shorter is almost always better. Facebook: 150–200 words. Instagram caption: 80–120 words. The full story lives on your microsite — the social posts are the trailer.',
      },
      {
        type: 'callout',
        content: 'Takeaway: The best descriptions read as if written by someone who knows the neighborhood. Lead with the strongest feature, stay factual, and finish with one clear next step. Review the final copy for Fair Housing and MLS compliance.',
      },
    ],
    cta: {
      heading: 'Get headline options and a full listing description',
      subtext: 'ListOps drafts the description, headlines, neighborhood story, and tone variants from the listing details and photos you enter.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['real-estate-email-marketing-guide', 'real-estate-social-media-strategy'],
  },

  {
    slug: 'ai-real-estate-marketing-guide',
    title: 'AI for Real Estate Marketing: The Practical Agent\'s Guide',
    description: 'How real estate agents can use AI tools to create marketing content faster, where human judgment still matters, and how to stay fair-housing aware.',
    publishedAt: '2026-03-04',
    updated: '2026-10-26',
    readingTime: '9 min read',
    category: 'AI & Technology',
    categoryColor: 'purple',
    heroEmoji: '🤖',
    excerpt: 'AI is useful in real estate marketing for first drafts: listing copy, social posts, email sequences, and print text. It does not replace local knowledge, relationships, or compliance review. Use it to remove blank-page work, then edit and approve everything yourself.',
    content: [
      {
        type: 'p',
        content: 'AI is now a common topic among agents. Some worry about being replaced, while others already use it every day.',
      },
      {
        type: 'p',
        content: 'The practical truth sits in the middle: AI does not replace good agents. It removes the parts of the job they shouldn\'t be doing anyway — grinding out social posts, rewriting email copy, staring at a blank page trying to describe a kitchen they toured three weeks ago.',
      },
      {
        type: 'h2',
        content: 'What AI Is Actually Good At in Real Estate Marketing',
      },
      {
        type: 'ul',
        items: [
          'Drafting listing descriptions from property data points — fast, consistent, never has writer\'s block',
          'Writing social post variations for different platforms and audiences',
          'Creating 6–8 week content calendars with different angles per week',
          'Generating email sequences (drip campaigns, Just Listed, open house)',
          'Writing print materials: brochures, postcards, yard sign copy',
          'Creating photo captions based on what\'s in each listing photo',
          'Translating content into Spanish for bilingual markets',
          'Writing microsite copy from property specs',
        ],
      },
      {
        type: 'h2',
        content: 'What AI Is Not Good At (And Where You Stay Irreplaceable)',
      },
      {
        type: 'p',
        content: 'AI writes the first draft. You make it real. The things that actually close deals — hyperlocal market knowledge, reading a buyer\'s emotional state in a showing, negotiating on behalf of a seller who needs 30 extra days — those aren\'t going anywhere.',
      },
      {
        type: 'ul',
        items: [
          'Hyperlocal nuance — "the good side of that school district" isn\'t in any database',
          'Relationship context — knowing a client\'s divorce situation changes every word of your email',
          'Negotiation judgment — no AI knows when to push and when to yield',
          'Trust — clients choose agents, not algorithms',
        ],
      },
      {
        type: 'h2',
        content: 'Fair Housing and AI: The Non-Negotiable Rules',
      },
      {
        type: 'p',
        content: 'This is where many agents get nervous about AI-generated content — and they\'re right to think carefully about it. The Fair Housing Act applies to AI output just as it does to anything you write yourself. If an AI generates discriminatory language, you\'re responsible.',
      },
      {
        type: 'blockquote',
        content: 'AI-generated listing copy must never reference race, color, national origin, religion, sex, familial status, or disability — directly or through "code words" like "perfect for empty nesters" or "walking distance to place of worship."',
      },
      {
        type: 'p',
        content: 'A tool built for real estate marketing may be designed to steer away from these issues, while a general-purpose AI tool may not be. Neither replaces your own review. Read every piece of AI-written copy against Fair Housing rules, your MLS rules, and your broker\'s guidance before publishing.',
      },
      {
        type: 'h2',
        content: 'The Output Quality Gap: Purpose-Built vs. Generic AI',
      },
      {
        type: 'p',
        content: 'A general-purpose AI can write anything, but it starts from a blank prompt and does not know your listing workflow. A purpose-built tool starts from your listing details and photos and produces a structured campaign. The tradeoff is flexibility versus speed and consistency.',
      },
      {
        type: 'h2',
        content: 'A Practical Workflow: AI-Assisted Listing Launch',
      },
      {
        type: 'ol',
        items: [
          'Add your listing details and photos to your tool as soon as your photos are ready',
          'Generate the full content package, then review it section by section',
          'Review the listing description first: check for accuracy, add any hyperlocal details the public records didn\'t capture',
          'Review the social posts: tweak your agent voice if needed, add personal observations from your showing',
          'Schedule Week 1 content across platforms',
          'Send the Just Listed email',
          'Set a calendar reminder for Week 3 to post the neighborhood piece',
          'The remaining weeks of content are already drafted. Review, schedule, and post',
        ],
      },
      {
        type: 'h2',
        content: 'The Learning Curve Is Shorter Than You Think',
      },
      {
        type: 'p',
        content: 'The #1 objection agents have to AI tools is "I\'ll have to learn a whole new system." Purpose-built real estate AI requires no prompting skill, no AI literacy, and no marketing background. You enter your listing and add photos. You get a campaign.',
      },
      {
        type: 'p',
        content: 'Agents who do all of this manually spend hours on work a tool can draft in minutes. That is not because AI is better at relationships, but because time spent on first drafts is time not spent with clients.',
      },
      {
        type: 'callout',
        content: 'Takeaway: Use AI for first drafts, keep human judgment for local knowledge and compliance, and choose a tool simple enough that you will actually use it on every listing.',
      },
    ],
    cta: {
      heading: 'See what AI-generated listing marketing actually looks like',
      subtext: 'Enter your listing details and photos and get a campaign draft covering social, email, print, and microsite copy. No prompting required.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['real-estate-listing-marketing-checklist', 'listing-description-writing-tips'],
  },

  {
    slug: 'real-estate-social-media-strategy',
    title: 'Real Estate Social Media Strategy: What Actually Works',
    description: 'Which platforms and formats to focus on, how often to post, and a 6-week content framework real estate agents can reuse on every listing.',
    publishedAt: '2026-02-11',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Social Media',
    categoryColor: 'blue',
    heroEmoji: '📱',
    excerpt: 'Short video, local expertise, and a repeatable per-listing calendar tend to work better than a weekly "Just Listed" graphic. This guide covers where to focus and what to post.',
    content: [
      {
        type: 'p',
        content: 'The best real estate social media strategy is simple: pick one or two platforms, favor short video and local expertise, and run a repeatable content calendar for every listing. Posting the same "Just Listed" graphic once a week is rarely enough on its own.',
      },
      {
        type: 'p',
        content: 'Here is what to focus on, and what to stop doing. Platform features change often, so treat the specifics as a starting point and check what is working in your market.',
      },
      {
        type: 'h2',
        content: 'The Platform Breakdown: Where to Focus',
      },
      {
        type: 'h3',
        content: 'Instagram: Still the Core',
      },
      {
        type: 'p',
        content: 'Instagram remains the highest-ROI platform for most residential real estate agents. Short video has generally been favored by the platform over static posts, so build video into your regular mix. Consistency matters more than any exact posting number.',
      },
      {
        type: 'ul',
        items: [
          'Reels: property walk-throughs, neighborhood tours, market updates (15-60 seconds)',
          'Carousels: multi-photo listings, before/after renovations, neighborhood guides',
          'Stories: daily behind-the-scenes, polls, link stickers to your listing microsite',
          'Static posts: professional photography, client testimonials, market data',
        ],
      },
      {
        type: 'h3',
        content: 'Facebook: Not Dead, Just Different',
      },
      {
        type: 'p',
        content: 'Facebook\'s organic reach on business pages is near zero, but the platform still matters for two things: Facebook Marketplace (huge for budget buyers) and Facebook Groups (neighborhood groups, local community pages). An active presence in your farm area\'s neighborhood groups builds brand recognition that pays off for years.',
      },
      {
        type: 'h3',
        content: 'TikTok: The Fastest Growth Channel',
      },
      {
        type: 'p',
        content: 'TikTok can reach younger buyers and first-time homebuyers, and its format tends to reward authenticity over polish, which is good news for agents who are not professional videographers. Results vary widely by market, so test it before committing.',
      },
      {
        type: 'h3',
        content: 'LinkedIn: Underrated for Move-Up Buyers',
      },
      {
        type: 'p',
        content: 'LinkedIn is the platform for corporate relocation leads, executive move-up buyers, and referral relationships with relocation coordinators. If your market has a strong corporate presence, a consistent LinkedIn presence is higher-leverage than most agents realize.',
      },
      {
        type: 'h2',
        content: 'Content That Actually Generates Leads',
      },
      {
        type: 'p',
        content: 'Stop thinking about social media as a billboard. The content that tends to generate real estate leads falls into four categories:',
      },
      {
        type: 'ol',
        items: [
          'Local market expertise — data, insights, neighborhood knowledge that demonstrates you know the area better than anyone',
          'Process transparency — what it actually looks like to buy or sell in your market right now',
          'Social proof — client results (with permission), testimonials, closed transaction milestones',
          'Listing content — but done as a story, not a catalog entry',
        ],
      },
      {
        type: 'h2',
        content: 'The Posting Frequency Trap',
      },
      {
        type: 'p',
        content: 'More posts don\'t mean more leads. Posting mediocre content five times a week is worse than posting exceptional content twice. Every weak post you publish trains your audience to scroll past your name.',
      },
      {
        type: 'p',
        content: 'The agents winning on social aren\'t grinding out content manually — they have systems. They batch-create content for each listing when the ideas are fresh, schedule it over six weeks, and then focus on engagement and relationships instead of staring at a blank post composer.',
      },
      {
        type: 'h2',
        content: 'The 6-Week Content Calendar Framework',
      },
      {
        type: 'p',
        content: 'For each listing, run these six weekly themes across all platforms. Each theme gives you a different angle to re-engage people who missed the previous weeks.',
      },
      {
        type: 'ol',
        items: [
          'Week 1: Just Listed — excitement, first impressions, call-to-action',
          'Week 2: Feature deep-dive — highlight the kitchen, primary suite, or outdoor space',
          'Week 3: Neighborhood story — schools, walkability, local favorites',
          'Week 4: Open house — social proof, FOMO, event-style content',
          'Week 5: Investment value — market position, price per square foot, appreciation story',
          'Week 6: Final call — urgency, last chance, direct response',
        ],
      },
      {
        type: 'callout',
        content: 'Takeaway: Pick your platforms, favor short video and local expertise, and run the same six-week framework on every listing. Consistency beats volume.',
      },
    ],
    cta: {
      heading: 'Get a 6-week social calendar for every listing',
      subtext: 'ListOps drafts Facebook posts, Instagram captions, TikTok scripts, and hashtag packs from your listing and photos, organized in a social calendar for you to review.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['real-estate-listing-marketing-checklist', 'ai-real-estate-marketing-guide'],
  },

  {
    slug: 'real-estate-marketing-tools',
    title: 'Real Estate Marketing Tools Worth Using: A Practical Stack',
    description: 'A category-by-category guide to the marketing tools real estate agents commonly use, what each type does, and how to keep your stack small.',
    publishedAt: '2026-01-28',
    updated: '2026-10-26',
    readingTime: '7 min read',
    category: 'Tools & Resources',
    categoryColor: 'indigo',
    heroEmoji: '🛠️',
    excerpt: 'Most agents need tools in six categories: campaign content, design, visuals, CRM, scheduling, and email. Here is what each does and how to keep the stack small.',
    content: [
      {
        type: 'p',
        content: 'A practical real estate marketing stack covers six jobs: generating campaign content, designing visuals, capturing property imagery, managing contacts, scheduling social posts, and sending email. Choose one tool per job, favor the ones you will use on every listing, and check current pricing and features before you commit, since both change often.',
      },
      {
        type: 'p',
        content: 'The tools named below are examples of well-known options in each category, not endorsements or a ranking. ListOps is our own product, and we flag it as such.',
      },
      { type: 'h2', content: 'Campaign and Content Generation' },
      { type: 'h3', content: 'ListOps (our product)' },
      {
        type: 'p',
        content: 'ListOps generates a campaign from your listing details and photos: social posts, email copy, print materials, a listing microsite with lead capture, QR codes, and a social calendar. Review and edit everything it produces before publishing.',
      },
      { type: 'h2', content: 'Design' },
      { type: 'h3', content: 'Canva and similar design tools' },
      {
        type: 'p',
        content: 'General design tools let you build custom graphics and store brand colors and fonts. The risk is the template trap: if you use stock templates unchanged, your marketing looks like everyone else\'s. Set up your brand once and reuse it.',
      },
      { type: 'h2', content: 'Property Visuals' },
      { type: 'h3', content: 'Professional photography, 3D tours, and floor plans' },
      {
        type: 'p',
        content: 'Strong photos are the foundation of every other piece of marketing. 3D tours and floor plans can help out-of-area buyers understand a home. Many photographers offer them as add-ons, and some platforms offer phone-based 3D tour options, so compare what fits your price point.',
      },
      { type: 'h2', content: 'CRM and Lead Management' },
      { type: 'h3', content: 'Real estate CRMs such as Follow Up Boss' },
      {
        type: 'p',
        content: 'A CRM keeps contacts, notes, and follow-up reminders in one place. Look for lead-source integrations that match where your leads come from, a usable mobile app, and a pipeline view that fits your workflow. Pricing varies by team size, so check the current plans.',
      },
      { type: 'h2', content: 'Social Scheduling' },
      { type: 'h3', content: 'Scheduling tools such as Buffer or Later' },
      {
        type: 'p',
        content: 'Schedulers let you batch posts and plan a calendar rather than posting in real time. Choose based on the platforms you use most and whether you want visual planning for Instagram. A simple plan is usually enough for an individual agent.',
      },
      { type: 'h2', content: 'Email Marketing' },
      { type: 'h3', content: 'Email platforms such as Mailchimp or Klaviyo' },
      {
        type: 'p',
        content: 'A dedicated email platform handles list management, templates, unsubscribes, and deliverability better than a personal inbox. Simpler tools suit smaller lists, while more advanced tools offer behavior-based triggers that matter once your list grows.',
      },
      { type: 'h2', content: 'Listing Websites' },
      {
        type: 'p',
        content: 'Every listing benefits from a clean page you can link everywhere. A listing microsite, like the one included with ListOps, gives you one URL for social posts, QR codes, and emails. A full agent website with IDX is a separate, larger project.',
      },
      { type: 'h2', content: 'What to Be Careful With' },
      {
        type: 'p',
        content: 'Tools that post automatically without your review can publish at the wrong moment, for example right after a price change, and can include wording you would not approve. Keep a human review step in your process.',
      },
      { type: 'h2', content: 'How to Choose' },
      {
        type: 'ol',
        items: [
          'List the jobs you actually do on every listing',
          'Pick the fewest tools that cover them',
          'Trial before paying, and check current pricing',
          'Confirm the tool fits your brokerage\'s compliance and branding rules',
          'Review the stack twice a year and drop what you do not use',
        ],
      },
      {
        type: 'callout',
        content: 'Takeaway: The best stack is the smallest one that covers your recurring jobs. A few tools you use on every listing beat a long list you use occasionally.',
      },
    ],
    cta: {
      heading: 'Cover the campaign step with one tool',
      subtext: 'ListOps drafts campaign copy, a listing microsite, QR codes, flyers, and a social calendar from your listing details and photos.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['ai-real-estate-marketing-guide', 'real-estate-social-media-strategy'],
  },

  {
    slug: 'real-estate-listing-marketing-checklist',
    title: 'The Complete Real Estate Listing Marketing Checklist',
    description: 'A step-by-step listing marketing checklist for residential agents, from pre-launch prep through week six. Run it on every listing.',
    publishedAt: '2026-01-14',
    updated: '2026-10-26',
    readingTime: '8 min read',
    category: 'Best Practices',
    categoryColor: 'amber',
    heroEmoji: '📋',
    excerpt: 'Most agents run the same plays on every listing: post a few photos on Facebook, send a Just Listed email, and hope the open house brings foot traffic. A better approach is to run a real, repeatable campaign. This checklist covers it from pre-launch to week six.',
    content: [
      {
        type: 'p',
        content: 'A complete listing marketing checklist covers four phases: pre-launch preparation, a high-energy launch week, sustained content in weeks two through four, and a renewed push in weeks five and six. Run it on every listing and you replace one-off posts with a real campaign.',
      },
      {
        type: 'p',
        content: 'This checklist is what that looks like in practice. It is a repeatable framework you can adapt to your market, your price point, and your seller\'s goals.',
      },
      {
        type: 'h2',
        content: 'Week 0: Before You Go Live',
      },
      {
        type: 'p',
        content: 'The marketing starts before the listing does. Agents who wait until MLS day one to think about content are already a week behind.',
      },
      {
        type: 'ul',
        items: [
          'Professional photography — minimum 25 photos, including exterior at golden hour',
          'Aerial/drone photography if the lot, neighborhood, or view is a selling point',
          'Floor plan or 3D tour where it suits the property and price point',
          'Gather the property story from the seller: renovations, best features, neighborhood favorites',
          'Draft your 10 headline variations so you can A/B test across channels',
          'Set up a listing microsite — gives you a clean URL to link from every piece of content',
          'Prepare your email list segment (buyers, neighbors, past clients)',
        ],
      },
      {
        type: 'h2',
        content: 'Week 1: Just Listed — Build Momentum Fast',
      },
      {
        type: 'p',
        content: 'The first 72 hours are the highest-leverage window you have. Buyer attention and algorithm reach peak immediately after a new listing hits. Don\'t waste it.',
      },
      {
        type: 'ul',
        items: [
          'Facebook post (200 words) — story-led, ends with a showing CTA',
          'Instagram carousel — 5-7 photos with punchy captions per slide',
          'Instagram Reel or Stories — 15-30 second walk-through clip',
          'Just Listed email to your full list — personalized subject line',
          'Short text to buyer contacts who have agreed to receive texts from you (check your brokerage rules and consent requirements)',
          'Neighborhood announcement — introduce the listing to nearby neighbors in person or with a short note',
          'Pin your Just Listed post to the top of your Facebook business page',
        ],
      },
      {
        type: 'h2',
        content: 'Weeks 2–4: Sustained Content That Sells',
      },
      {
        type: 'p',
        content: 'This is where most agents fall off. They do the big launch and then go quiet. The problem is that buyers don\'t always see your Week 1 content — algorithms throttle reach, people miss emails, and life gets in the way.',
      },
      {
        type: 'p',
        content: 'A 6-week calendar with different angles for each week keeps your listing in front of new eyeballs without looking desperate or repetitive.',
      },
      {
        type: 'ul',
        items: [
          'Week 2 — Feature spotlight: highlight the best room or feature with a dedicated post',
          'Week 3 — Neighborhood story: schools, restaurants, walkability, commute times',
          'Week 4 — Open house push: create urgency with social proof (only if accurate)',
          'TikTok and LinkedIn if your market has strong presence there',
          'Email drip to buyers who opened Week 1\'s email but didn\'t respond',
        ],
      },
      {
        type: 'h2',
        content: 'Print & Offline: Still Matters',
      },
      {
        type: 'p',
        content: 'Digital marketing is table stakes. The agents who win in tight markets are the ones doing both — and doing the offline pieces well, not as an afterthought.',
      },
      {
        type: 'ul',
        items: [
          'Yard sign rider with a QR code linking to your microsite',
          'Postcard mailer to nearby neighbors — "Just Listed" and "Your neighbor is moving"',
          'Brochure inside the home for open house visitors to take',
          'Just Listed announcement in any local Facebook neighborhood groups',
          'Submit to local community newsletters if available',
        ],
      },
      {
        type: 'h2',
        content: 'Weeks 5–6: The Close',
      },
      {
        type: 'p',
        content: 'If the listing hasn\'t sold by Week 5, your messaging needs to shift. Urgency without desperation is the goal. Reframe the opportunity rather than signaling panic.',
      },
      {
        type: 'ul',
        items: [
          '"Still Available" email — reframe with new information (a price adjustment if you and the seller have agreed one, or new information about the home)',
          'Testimonial post from seller if they\'re willing',
          'Behind-the-scenes content — "What makes this home special" from the listing agent perspective',
          'Final Call post — direct, specific asking price, specific showing CTA',
          'Re-engage warm leads who attended the open house or requested the floor plan',
        ],
      },
      {
        type: 'callout',
        content: 'Takeaway: Run the same checklist on every listing. Prepare before launch, concentrate effort in the first week, vary your angle through week six, and use tools to make the system faster.',
      },
    ],
    cta: {
      heading: 'Run this checklist on every listing',
      subtext: 'ListOps generates campaign copy for social, email, print, and a listing microsite from your listing details and photos, ready for you to review.',
      buttonText: 'Try ListOps',
    },
    relatedSlugs: ['real-estate-social-media-strategy', 'why-real-estate-agents-lose-listings'],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(p => p.slug === slug)
}

export function getRelatedPosts(slugs: string[]): BlogPost[] {
  return slugs.map(s => BLOG_POSTS.find(p => p.slug === s)).filter(Boolean) as BlogPost[]
}
