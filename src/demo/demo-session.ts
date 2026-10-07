import { Session } from '@supabase/supabase-js';
import { DEMO_EMAIL, DEMO_MEMBER_SINCE } from './demo-data';

export function createDemoSession(): Session {
  return {
    access_token: 'demo',
    refresh_token: 'demo',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'demo',
      aud: 'authenticated',
      email: DEMO_EMAIL,
      created_at: DEMO_MEMBER_SINCE,
      app_metadata: {},
      user_metadata: {},
    },
  } as Session;
}
