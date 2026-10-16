import type { GoogleContact } from '../types/gqueues';

export async function fetchContacts(accessToken: string): Promise<GoogleContact[]> {
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos&pageSize=100&sortOrder=FIRST_NAME_ASCENDING',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      console.warn(`People API response status ${res.status}`);
      return [];
    }

    const data = await res.json();
    const connections = data.connections || [];

    const contacts: GoogleContact[] = [];

    for (const person of connections) {
      const email = person.emailAddresses?.[0]?.value;
      const name = person.names?.[0]?.displayName || email;
      const photo = person.photos?.[0]?.url;

      if (email || name) {
        contacts.push({
          id: person.resourceName || email || Math.random().toString(),
          name: name || email || 'Colleague',
          email: email || '',
          avatarUrl: photo,
        });
      }
    }

    return contacts;
  } catch (err) {
    console.error('Failed to fetch Google Contacts:', err);
    return [];
  }
}
