/**
 * Generates structured support responses when the LLM is down.
 */
export function generateLlmFallbackResponse(userMessage: string): string {
  const normalized = userMessage.toLowerCase();

  if (normalized.includes('refund') || normalized.includes('return') || normalized.includes('policy')) {
    return "I am currently responding via my local backup system, but I can help you with refunds! We offer a full 14-day money-back guarantee for all plans. To request a refund, please send your invoice details and session ID to our billing team at billing@example.com. We typically process requests within 3-5 business days.";
  }

  if (
    normalized.includes('price') ||
    normalized.includes('pricing') ||
    normalized.includes('cost') ||
    normalized.includes('plan')
  ) {
    return "Although I'm running in offline backup mode, here is our current pricing breakdown:\n\n" +
      "- **Starter Plan**: $19/month (1 user, basic dashboard, standard support)\n" +
      "- **Professional Plan**: $49/month (up to 5 users, advanced analytics, priority support)\n" +
      "- **Enterprise Plan**: Custom quote (unlimited users, custom integrations, dedicated success manager)\n\n" +
      "You can upgrade your subscription at any time via your account settings dashboard.";
  }

  if (
    normalized.includes('contact') ||
    normalized.includes('support') ||
    normalized.includes('help') ||
    normalized.includes('email') ||
    normalized.includes('phone')
  ) {
    return "I am currently using a local fallback engine. You can get in touch with our human support team directly via:\n\n" +
      "- **Email**: support@example.com (replies within 2 hours during business hours)\n" +
      "- **Live Chat**: Click the chat icon on our main website (Mon-Fri, 9 AM - 5 PM EST)\n" +
      "- **Documentation**: Browse guides at help.example.com";
  }

  if (normalized.includes('hour') || normalized.includes('time') || normalized.includes('open')) {
    return "Our support team operates Monday through Friday, from 9:00 AM to 5:00 PM Eastern Standard Time (EST). If you contact us outside these hours, we will get back to you first thing on the next business day.";
  }

  if (
    normalized.includes('hello') ||
    normalized.includes('hi') ||
    normalized.includes('hey') ||
    normalized.includes('greetings')
  ) {
    return "Hello! I am currently running on a local backup system as our primary AI model is temporarily unreachable. How can I help you today? (I can answer questions regarding refund policies, pricing plans, support contact details, or business hours!)";
  }

  return "I'm sorry, I am experiencing temporary connectivity issues with my primary AI reasoning engine and am currently operating on a backup local system. I can still answer basic questions about our refund policy, pricing/plans, hours, or support contact details. Otherwise, please try sending your message again in a few moments!";
}
