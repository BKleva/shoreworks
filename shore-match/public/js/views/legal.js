import { h } from '../ui.js';

export default function legal({ path }) {
  return path === '/privacy' ? privacy() : terms();
}

const P = (...c) => h('p', {}, ...c);

function terms() {
  return h('div', { class: 'wrap' }, h('article', { class: 'card stack legal' },
    h('h1', {}, 'Terms of Use'), P('Last updated: November 2026'),
    h('h2', {}, '1. What Shore Match is'),
    P('Shore Match is an introductions and networking tool for local founders and investors. We do not broker, solicit, recommend or sell securities, we do not hold or transmit funds, and we do not act as a broker-dealer, funding portal, investment adviser or finder.'),
    h('h2', {}, '2. No advice, no guarantees'),
    P('Nothing on the platform is investment, legal or tax advice. Match scores are a simple convenience calculation, not an assessment of quality or suitability. Early-stage investing is high risk and you can lose your entire investment. Do your own due diligence and talk to your own advisers before any transaction.'),
    h('h2', {}, '3. Your responsibilities'),
    P('You are responsible for the accuracy of what you post and for complying with all securities, tax and other laws that apply to any deal you pursue, including limits on who may solicit or invest. Do not post false, misleading or confidential third-party information. Do not spam or harass other members.'),
    h('h2', {}, '4. Investor acknowledgement'),
    P('Investors confirm at sign-up that they are accredited (or acting for an accredited investor) and understand the risks. We rely on this self-confirmation and may ask for more verification later.'),
    h('h2', {}, '5. Content and moderation'),
    P('You keep ownership of your content and give us permission to display it to other members as part of the service. We may verify, hide or remove content and suspend accounts that break these terms.'),
    h('h2', {}, '6. Privacy of contact details'),
    P('Email addresses are shown to the other party only after both sides have agreed to connect. Once shared, we cannot control what the other party does with them.'),
    h('h2', {}, '7. Liability'),
    P('The service is provided “as is”. To the fullest extent permitted by law, Shore Match is not liable for any deal, loss or dispute between members.')));
}

function privacy() {
  return h('div', { class: 'wrap' }, h('article', { class: 'card stack legal' },
    h('h1', {}, 'Privacy Policy'), P('Last updated: November 2026'),
    h('h2', {}, 'What we collect'),
    P('Your name, email, password (stored only as a salted hash), the profile and proposal details you enter, and the messages you send through the platform.'),
    h('h2', {}, 'Who sees it'),
    P('Profiles and open proposals are visible to signed-in members on the other side of the marketplace. Draft proposals and investor notes are private. Your email is shown to a counterpart only after you both accept a connection.'),
    h('h2', {}, 'Cookies'),
    P('We use one essential, HTTP-only cookie to keep you signed in. No advertising or tracking cookies.'),
    h('h2', {}, 'Your choices'),
    P('You can edit your profile any time and permanently delete your account and everything tied to it from the Profile page.')));
}
