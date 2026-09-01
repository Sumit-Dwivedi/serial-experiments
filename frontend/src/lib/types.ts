// Hand-written mirrors of the Pydantic models in backend/models/vault.py.
// Change one, change the other in the same edit.

export interface Attachment {
  id: string;
  cipher_name: string;
  name_iv: string;
  cipher_data: string;
  data_iv: string;
  size: number;
}

export interface SecretCreated {
  id: string;
  expires_at: string;
  burn_after_read: boolean;
  receipt_token: string;
}

export interface SecretReceipt {
  opened: boolean;
  opened_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface SecretMeta {
  id: string;
  has_passphrase: boolean;
  burn_after_read: boolean;
  expires_at: string;
  attachment_count: number;
  max_reads: number;
  reads_left: number;
}

export interface SecretPayload {
  id: string;
  cipher_text: string;
  iv: string;
  salt: string | null;
  has_passphrase: boolean;
  burned: boolean;
  expires_at: string;
  attachments: Attachment[];
  burn_token: string;
  reads_left: number;
  auto_purge_at: string | null;
}

export interface WallReply {
  id: string;
  body: string;
  ghost: string;
  created_at: string;
}

export interface WallPost {
  id: string;
  body: string;
  tag: string;
  ghost: string;
  created_at: string;
  expires_at: string;
  echoes: number;
  replies: WallReply[];
}

export interface PowChallengeResponse {
  challenge: string;
  difficulty: number;
}

export interface BurnResult {
  burned: boolean;
  detail: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  owner_hash: string;
  status: "open" | "closed";
  reply_count: number;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
}

export interface ThreadReply {
  id: string;
  thread_id: string;
  parent_reply_id: string | null;
  participant_hash: string;
  is_op: boolean;
  body: string;
  created_at: string;
  depth: number;
  children: ThreadReply[];
}

export interface ThreadDetailData extends ThreadSummary {
  body: string;
  replies: ThreadReply[];
}
