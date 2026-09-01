import ReplyNode from "@/components/ReplyNode";
import type { ThreadReply } from "@/lib/types";

/**
 * Renders a reply's children. Kept in its own module so the recursion between a node
 * and its children crosses a file boundary — a self-recursive JSX component inside a
 * single file overflows the dev-server's source transform.
 */
export default function ReplyChildren({
  items,
  threadId,
  closed,
  onReplied,
}: {
  items: ThreadReply[];
  threadId: string;
  closed: boolean;
  onReplied: () => void;
}) {
  return (
    <ul data-testid="reply-children">
      {items.map((c) => (
        <ReplyNode
          key={c.id}
          reply={c}
          threadId={threadId}
          closed={closed}
          onReplied={onReplied}
        />
      ))}
    </ul>
  );
}
