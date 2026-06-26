export function track(eventName, properties = {}) {
  if (typeof fbq !== 'undefined') {
    const standardEvents = ['Lead', 'ViewContent', 'BookClicked'];
    if (standardEvents.includes(eventName)) {
      fbq('track', eventName, properties);
    } else {
      fbq('trackCustom', eventName, properties);
    }
  }
  if (import.meta.env.DEV) console.log('[track]', eventName, properties);
}
