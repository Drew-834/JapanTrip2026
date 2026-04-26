import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb, getFirebaseStorage } from "@/lib/firebase";
import { useTrip } from "@/context/TripContext";
import type { Comment, Post, PostType, Reaction } from "@/types";

const EMOJIS = ["👍", "😍", "🤣", "🙏", "⚠️", "🚃", "🍜"];

export function FeedPage() {
  const { userId, displayName } = useTrip();
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState<PostType>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(getDb(), "posts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const rows: Post[] = [];
      snap.forEach((d) => {
        const x = d.data() as Omit<Post, "id">;
        rows.push({ id: d.id, ...x });
      });
      setPosts(rows);
    });
  }, []);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!text.trim() && !file) {
      setErr("Add text or a photo.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const postRef = doc(collection(getDb(), "posts"));
      const postId = postRef.id;
      let imageUrls: string[] = [];
      if (file) {
        const storage = getFirebaseStorage();
        const objectRef = ref(storage, `posts/${postId}/${file.name}`);
        await uploadBytes(objectRef, file);
        imageUrls = [await getDownloadURL(objectRef)];
      }
      await setDoc(postRef, {
        authorId: userId,
        authorName: displayName,
        text: text.trim(),
        imageUrls,
        type,
        createdAt: serverTimestamp(),
      });
      setText("");
      setFile(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Moments</h1>
      <p className="muted">Selfies, food shots, warnings, quick updates — comments and reactions below each post.</p>

      <div className="card">
        <h2>New post</h2>
        <form className="stack" onSubmit={submitPost}>
          <div className="row">
            <label className="muted">
              Type{" "}
              <select value={type} onChange={(e) => setType(e.target.value as PostType)}>
                <option value="photo">Photo / moment</option>
                <option value="food">Food</option>
                <option value="warning">Friendly warning</option>
                <option value="update">Update</option>
              </select>
            </label>
          </div>
          <textarea placeholder="What’s happening?" value={text} onChange={(e) => setText(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {err && <p className="err" style={{ margin: 0 }}>{err}</p>}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Posting…" : "Post"}
          </button>
        </form>
      </div>

      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const { userId, displayName } = useTrip();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    const c = collection(getDb(), "posts", post.id, "comments");
    const q = query(c, orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const rows: Comment[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Comment, "id">) }));
      setComments(rows);
    });
  }, [post.id]);

  useEffect(() => {
    const r = collection(getDb(), "posts", post.id, "reactions");
    return onSnapshot(r, (snap) => {
      const rows: Reaction[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Reaction, "id">) }));
      setReactions(rows);
    });
  }, [post.id]);

  const grouped = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const k = r.emoji;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [reactions]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !commentText.trim()) return;
    await addDoc(collection(getDb(), "posts", post.id, "comments"), {
      authorId: userId,
      authorName: displayName,
      text: commentText.trim(),
      createdAt: serverTimestamp(),
    });
    setCommentText("");
  }

  async function toggleReaction(emoji: string) {
    if (!userId) return;
    const rid = `${userId}__${emoji}`;
    const rref = doc(getDb(), "posts", post.id, "reactions", rid);
    const existing = reactions.find((r) => r.id === rid);
    if (existing) await deleteDoc(rref);
    else
      await setDoc(rref, {
        emoji,
        userId,
        userName: displayName,
      });
  }

  return (
    <div className="card feed-post">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{post.authorName}</strong>
        <span className="muted" style={{ textTransform: "capitalize" }}>
          {post.type}
        </span>
      </div>
      {post.text && <p style={{ margin: "0.5rem 0 0" }}>{post.text}</p>}
      {post.imageUrls?.map((u) => (
        <img key={u} src={u} alt="" />
      ))}
      <div className="reactions">
        {EMOJIS.map((em) => {
          const list = grouped.get(em) ?? [];
          const on = list.some((r) => r.userId === userId);
          return (
            <button
              key={em}
              type="button"
              className={`reaction-btn${on ? " on" : ""}`}
              onClick={() => toggleReaction(em)}
            >
              {em} {list.length > 0 ? list.length : ""}
            </button>
          );
        })}
      </div>
      <div className="comments">
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <strong>{c.authorName}:</strong> {c.text}
          </div>
        ))}
        <form className="row" style={{ marginTop: "0.5rem" }} onSubmit={addComment}>
          <input
            type="text"
            placeholder="Add a comment"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            style={{ flex: 1, minWidth: 120, maxWidth: "none" }}
          />
          <button type="submit" className="btn secondary">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
