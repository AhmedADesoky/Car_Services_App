import { Logger } from '@nestjs/common';

/**
 * Outgoing messages (SMS / WhatsApp / email). Mostafa's module will add the real providers
 * (WhatsApp Cloud API per station, an Egyptian SMS gateway, email).
 * Until then the "console" provider prints the message in the backend log - DEVELOPMENT ONLY.
 */
export interface Outgoing_Message {
  channel: 'sms' | 'whatsapp' | 'email';
  to: string;
  template: 'owner_invitation' | 'otp';
  text: string;
}

const logger = new Logger('Messaging');

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 4 ? '****' : `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export async function sendMessage(message: Outgoing_Message): Promise<void> {
  if (process.env.NODE_ENV === 'production' && (process.env.MESSAGING_PROVIDER ?? 'console') === 'console') {
    throw new Error('No real messaging provider configured for production (MESSAGING_PROVIDER)');
  }
  // Dev only: the text contains a one-time link so a developer can complete the flow locally.
  logger.log(`[console ${message.channel}] to ${maskPhone(message.to)} (${message.template}): ${message.text}`);
}
