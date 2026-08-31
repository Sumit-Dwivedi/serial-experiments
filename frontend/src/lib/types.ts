// Hand-written mirrors of the Pydantic models in backend/models/vault.py.
// Change one, change the other in the same edit.

export interface SecretCreated {
  id: string;
  expires_at: string;
  burn_after_read: boolean;
}

export interface SecretMeta {
  id: string;
  has_passphrase: boolean;
  burn_after_read: boolean;
  expires_at: string;
}

export interface SecretPayload {
  id: string;
  cipher_text: string;
  iv: string;
  salt: string | null;
  has_passphrase: boolean;
  burned: boolean;
  expires_at: string;
}

export interface WallPost {
  id: string;
  body: string;
  tag: string;
  ghost: string;
  created_at: string;
  echoes: number;
}
