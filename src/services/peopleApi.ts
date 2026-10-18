import type { GoogleContact } from '../types/gqueues';

const CUSTOM_ROSTER_KEY = 'gqueues_custom_team_roster';

export function getCustomTeammates(): GoogleContact[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROSTER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse custom team roster:', e);
  }
  return [];
}

export function saveCustomTeammate(contact: Omit<GoogleContact, 'id'> & { id?: string }): GoogleContact {
  const existing = getCustomTeammates();
  const normalizedEmail = contact.email.toLowerCase().trim();
  const found = existing.find((c) => c.email.toLowerCase() === normalizedEmail);

  const fullContact: GoogleContact = {
    id: found?.id || contact.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: contact.name.trim() || contact.email.split('@')[0],
    email: normalizedEmail,
    avatarUrl: contact.avatarUrl,
    jobTitle: contact.jobTitle || 'Team Member',
    source: 'custom',
  };

  const updated = [fullContact, ...existing.filter((c) => c.email.toLowerCase() !== normalizedEmail)];
  try {
    localStorage.setItem(CUSTOM_ROSTER_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save custom teammate:', e);
  }
  return fullContact;
}

export function removeCustomTeammate(email: string): void {
  const existing = getCustomTeammates();
  const normalizedEmail = email.toLowerCase().trim();
  const updated = existing.filter((c) => c.email.toLowerCase() !== normalizedEmail);
  try {
    localStorage.setItem(CUSTOM_ROSTER_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to remove custom teammate:', e);
  }
}

export async function fetchContacts(accessToken: string): Promise<GoogleContact[]> {
  const contactMap = new Map<string, GoogleContact>();

  // 1. Load custom saved organization roster
  const customList = getCustomTeammates();
  for (const c of customList) {
    if (c.email) contactMap.set(c.email.toLowerCase(), c);
  }

  // 2. Fetch Google Contacts connections (Personal Contacts)
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos,organizations&pageSize=1000&sortOrder=FIRST_NAME_ASCENDING',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const connections = data.connections || [];

      for (const person of connections) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || email;
        const photo = person.photos?.[0]?.url;
        const jobTitle = person.organizations?.[0]?.title || person.organizations?.[0]?.department;

        if (email) {
          const lower = email.toLowerCase();
          if (!contactMap.has(lower)) {
            contactMap.set(lower, {
              id: person.resourceName || email,
              name: name || email,
              email: lower,
              avatarUrl: photo,
              jobTitle,
              source: 'contacts',
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Note: Personal Google Contacts fetch failed:', err);
  }

  // 3. Fetch Google Workspace Directory (Organization Domain Users)
  try {
    const dirRes = await fetch(
      'https://people.googleapis.com/v1/people:searchDirectory?readMask=names,emailAddresses,photos,organizations&query=&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE,DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT&pageSize=50',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (dirRes.ok) {
      const dirData = await dirRes.json();
      const people = dirData.people || [];
      for (const person of people) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || email;
        const photo = person.photos?.[0]?.url;
        const jobTitle = person.organizations?.[0]?.title || person.organizations?.[0]?.department;

        if (email) {
          const lower = email.toLowerCase();
          contactMap.set(lower, {
            id: person.resourceName || email,
            name: name || email,
            email: lower,
            avatarUrl: photo,
            jobTitle: jobTitle || 'Organization Member',
            source: 'directory',
          });
        }
      }
    }
  } catch (err) {
    // Expected if organization directory is restricted by admin policy
    console.info('Google Workspace directory search unavailable or restricted by workspace admin');
  }

  // 4. Fetch Google Other Contacts (Frequent Workspace Collaborators)
  try {
    const otherRes = await fetch(
      'https://people.googleapis.com/v1/otherContacts?readMask=names,emailAddresses,photos&pageSize=1000',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (otherRes.ok) {
      const otherData = await otherRes.json();
      const otherList = otherData.otherContacts || [];
      for (const person of otherList) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || email;
        const photo = person.photos?.[0]?.url;

        if (email) {
          const lower = email.toLowerCase();
          if (!contactMap.has(lower)) {
            contactMap.set(lower, {
              id: person.resourceName || email,
              name: name || email,
              email: lower,
              avatarUrl: photo,
              source: 'other',
            });
          }
        }
      }
    }
  } catch (err) {
    // Optional scope / domain
  }

  return Array.from(contactMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
