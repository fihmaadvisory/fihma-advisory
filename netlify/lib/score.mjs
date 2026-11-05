// Scoring logic for the Fihma Advisory Business Scorecard.
// Pure functions so they can be tested without network access.

const BOOKING = [
  ["calendly.com", "Calendly"],
  ["acuityscheduling.com", "Acuity"],
  ["squareup.com/appointments", "Square Appointments"],
  ["square.site", "Square"],
  ["book.squareup.com", "Square Appointments"],
  ["booksy.com", "Booksy"],
  ["vagaro.com", "Vagaro"],
  ["fresha.com", "Fresha"],
  ["glossgenius.com", "GlossGenius"],
  ["mindbodyonline.com", "Mindbody"],
  ["zocdoc.com", "Zocdoc"],
  ["localmed.com", "LocalMed"],
  ["nexhealth.com", "NexHealth"],
  ["modento", "Modento"],
  ["setmore.com", "Setmore"],
  ["simplybook", "SimplyBook"],
  ["housecallpro.com", "Housecall Pro"],
  ["getjobber.com", "Jobber"],
  ["clienthub.getjobber", "Jobber"],
  ["servicetitan.com", "ServiceTitan"],
  ["schedulista", "Schedulista"],
  ["opentable.com", "OpenTable"],
  ["resy.com", "Resy"],
  ["tockhq.com", "Tock"],
  ["exploretock.com", "Tock"],
  ["clio.com", "Clio"],
  ["janeapp.com", "Jane"],
  ["cal.com", "Cal.com"],
  ["youcanbook.me", "YouCanBookMe"],
  ["appointy.com", "Appointy"],
  ["schedulicity.com", "Schedulicity"],
  ["boulevard.io", "Boulevard"],
  ["joinblvd.com", "Boulevard"],
  ["petexec.net", "PetExec"],
  ["gingrapp.com", "Gingr"],
  ["shopmonkey", "Shopmonkey"],
  ["tekmetric", "Tekmetric"],
];

const CHAT = [
  ["intercom", "Intercom"],
  ["tawk.to", "Tawk.to"],
  ["drift.com", "Drift"],
  ["podium.com", "Podium"],
  ["birdeye", "Birdeye"],
  ["livechatinc", "LiveChat"],
  ["tidio", "Tidio"],
  ["crisp.chat", "Crisp"],
  ["zendesk", "Zendesk"],
  ["hs-scripts.com", "HubSpot"],
  ["olark", "Olark"],
  ["smith.ai", "Smith.ai"],
  ["ngage", "Ngage"],
  ["apexchat", "ApexChat"],
  ["weave", "Weave"],
  ["gorgias", "Gorgias"],
  ["freshchat", "Freshchat"],
  ["manychat", "ManyChat"],
];

const BOOKING_WORDS = /\b(book (now|online|an appointment|a table|your)|schedule (now|online|an appointment|a service)|request an appointment|make a reservation|reserve (now|a table))\b/i;

const PAIN_WORDS =
  /\b(call(ed|ing)? back|never (answer|answered|called|responded|returned)|no one (answer|answered|picks|picked)|nobody (answer|answered|picks|picked)|voicemail|couldn'?t get through|can'?t get through|didn'?t (answer|respond|call)|hard to (reach|book|get)|on hold|no response|never heard back|unresponsive|rude on the phone|appointment|book(ing)?|wait(ed|ing)? (for|over))\b/i;

function find(list, haystack) {
  for (const [needle, name] of list) if (haystack.includes(needle)) return name;
  return null;
}

export function analyzeWebsite({ ok, html = "", finalUrl = "" }) {
  if (!ok) return { reachable: false, https: finalUrl.startsWith("https://") };
  const lower = html.toLowerCase();
  const bookingTool = find(BOOKING, lower);
  const forms = lower.match(/<form[\s\S]*?<\/form>/g) || [];
  const hasContactForm = forms.some(
    (f) => /type=["']?email|name=["']?(email|message|phone)|<textarea/.test(f) && !/type=["']?search/.test(f)
  ) || /wpcf7|gform_|hsforms|jotform|typeform|formstack|wufoo|ninja-forms|elementor-form|squarespace-form|wixforms|formspree|netlify/.test(lower);
  return {
    reachable: true,
    https: finalUrl.startsWith("https://"),
    mobileViewport: /<meta[^>]+name=["']?viewport/.test(lower),
    clickToCall: /href=["']?tel:/.test(lower),
    bookingTool,
    bookingButton: !bookingTool && BOOKING_WORDS.test(html),
    chatTool: find(CHAT, lower),
    contactForm: hasContactForm,
  };
}

function reviewInsights(reviews = []) {
  const sixMonths = Date.now() - 1000 * 60 * 60 * 24 * 183;
  const recentLow = [];
  const pain = [];
  for (const r of reviews) {
    const text = r.text?.text || r.originalText?.text || "";
    const when = r.publishTime ? Date.parse(r.publishTime) : 0;
    if (r.rating <= 3 && when >= sixMonths) recentLow.push(r);
    if (r.rating <= 3 && PAIN_WORDS.test(text)) {
      const snippet = text.length > 140 ? text.slice(0, 137).trim() + "..." : text;
      pain.push({ rating: r.rating, when: r.relativePublishTimeDescription || "", snippet });
    }
  }
  return { sampled: reviews.length, recentLow: recentLow.length, pain: pain.slice(0, 2) };
}

// Returns { business, score, grade, categories[], issues[], wins[] }
export function scoreBusiness(place, site) {
  const cats = [];
  const issues = [];
  const wins = [];
  const add = (key, label, points, max) => cats.push({ key, label, points: Math.round(points), max });

  // 1. Reputation (20)
  const rating = place.rating ?? 0;
  const count = place.userRatingCount ?? 0;
  let rep = rating >= 4.7 ? 12 : rating >= 4.4 ? 10 : rating >= 4.0 ? 7 : rating >= 3.5 ? 4 : rating > 0 ? 2 : 0;
  rep += count >= 200 ? 8 : count >= 100 ? 7 : count >= 50 ? 5 : count >= 20 ? 3 : count > 0 ? 1 : 0;
  add("reputation", "Google reputation", rep, 20);
  if (count < 50)
    issues.push({
      cat: "reputation",
      title: `Only ${count} Google review${count === 1 ? "" : "s"}`,
      cost: "Most people compare 2 to 3 businesses before calling. Fewer reviews than nearby competitors means you lose the comparison before they ever pick up the phone.",
      fix: "An automatic text asking happy customers for a review after every visit.",
    });
  else wins.push(`${count} Google reviews at ${rating.toFixed(1)} stars`);
  if (rating > 0 && rating < 4.3)
    issues.push({
      cat: "reputation",
      title: `${rating.toFixed(1)} star rating`,
      cost: "Many customers filter out anything under 4.0 to 4.5 stars, so a few points can hide you from search results.",
      fix: "Review requests to happy customers plus fast, professional replies to unhappy ones.",
    });

  const rv = reviewInsights(place.reviews);

  // 2. Online booking (25)
  const booking = site?.bookingTool || site?.bookingButton;
  add("booking", "Online booking", site?.bookingTool ? 25 : site?.bookingButton ? 15 : 0, 25);
  if (!site || !site.reachable) {
    // handled under website
  } else if (!booking)
    issues.push({
      cat: "booking",
      title: "No way to book online",
      cost: "Lots of customers look for an appointment at night or on weekends. Without online booking they have to remember to call back tomorrow, and many book with whoever let them book tonight.",
      fix: "A booking page or AI receptionist that schedules 24/7 and syncs to your calendar.",
    });
  else wins.push(site.bookingTool ? `Online booking through ${site.bookingTool}` : "Booking button on your website");

  // 3. Website basics (15)
  let web = 0;
  if (!place.websiteUri) {
    issues.push({
      cat: "website",
      title: "No website on your Google profile",
      cost: "People who find you on Google can't check your services, prices or hours, so they move on to a business that shows them.",
      fix: "A simple one page site linked from your Google profile.",
    });
  } else if (!site?.reachable) {
    web = 3;
    issues.push({
      cat: "website",
      title: "Your website didn't load",
      cost: "When we tried to open your site it failed or took too long. Customers who hit the same thing usually don't try twice.",
      fix: "Check hosting and fix the link on your Google profile.",
    });
  } else {
    web += 5;
    web += site.https ? 3 : 0;
    web += site.mobileViewport ? 3 : 0;
    web += site.clickToCall ? 4 : 0;
    if (!site.https)
      issues.push({
        cat: "website",
        title: "Website shows \"Not secure\"",
        cost: "Browsers warn visitors your site isn't secure, which makes people hesitate to fill out a form or call.",
        fix: "A free SSL certificate from your web host.",
      });
    if (!site.mobileViewport)
      issues.push({
        cat: "website",
        title: "Website isn't built for phones",
        cost: "Most local searches happen on a phone. A site that needs pinching and zooming loses visitors fast.",
        fix: "A mobile friendly layout.",
      });
    if (!site.clickToCall)
      issues.push({
        cat: "website",
        title: "No tap to call button",
        cost: "Mobile visitors have to copy your number by hand. Every extra step loses some of them.",
        fix: "Make your phone number a tap to call link.",
      });
  }
  add("website", "Website basics", web, 15);

  // 4. Capturing leads (15)
  let cap = 0;
  if (site?.reachable) {
    cap += site.contactForm ? 7 : 0;
    cap += site.chatTool ? 8 : 0;
    if (!site.contactForm)
      issues.push({
        cat: "leads",
        title: "No contact form",
        cost: "Visitors who don't want to call have no way to reach you, so they leave.",
        fix: "A short contact form that sends you an instant text alert.",
      });
    if (!site.chatTool)
      issues.push({
        cat: "leads",
        title: "No chat or instant reply",
        cost: "Customers who get an answer within minutes are far more likely to book than ones who wait hours. Without instant replies, the fastest competitor wins.",
        fix: "An AI chat or text assistant that answers questions and books customers instantly.",
      });
    else wins.push(`Live chat through ${site.chatTool}`);
  }
  add("leads", "Capturing leads", cap, 15);

  // 5. Google profile (10)
  let prof = 0;
  if (place.regularOpeningHours) prof += 5;
  else
    issues.push({
      cat: "profile",
      title: "No hours on Google",
      cost: "Customers can't tell if you're open, so they call someone who shows they are.",
      fix: "Add your hours to your Google Business Profile.",
    });
  if (place.nationalPhoneNumber) prof += 5;
  else
    issues.push({
      cat: "profile",
      title: "No phone number on Google",
      cost: "The call button on your Google listing is missing, which is the most common way local customers contact a business.",
      fix: "Add your number to your Google Business Profile.",
    });
  add("profile", "Google profile", prof, 10);

  // 6. Speed (15) is filled in by the client from /api/speed. Placeholder for now.
  add("speed", "Mobile speed", 0, 15);

  if (rv.pain.length)
    issues.unshift({
      cat: "reputation",
      title: "Recent reviews mention trouble reaching you",
      cost: "Your own customers are telling people they had trouble getting through or getting booked. Prospects read these before they call.",
      fix: "An AI receptionist that answers every call and text, and books on the spot.",
      quotes: rv.pain,
    });

  const base = cats.filter((c) => c.key !== "speed").reduce((s, c) => s + c.points, 0);

  return {
    business: {
      name: place.displayName?.text || "Your business",
      address: place.formattedAddress || "",
      type: place.primaryTypeDisplayName?.text || "",
      mapsUrl: place.googleMapsUri || "",
      website: place.websiteUri || "",
      rating,
      reviewCount: count,
    },
    scoreWithoutSpeed: base, // out of 85
    categories: cats,
    issues,
    wins,
    reviewsSampled: rv.sampled,
    checkedSpeed: Boolean(site?.reachable),
  };
}

export function speedPoints(perf) {
  // perf is a 0 to 1 Lighthouse performance score
  if (perf == null) return null;
  if (perf >= 0.9) return 15;
  if (perf >= 0.75) return 12;
  if (perf >= 0.5) return 8;
  if (perf >= 0.3) return 4;
  return 1;
}
