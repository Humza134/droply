import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const {
      userId: bodyUserId,
      name,
      fileUrl,
      thumbnailUrl,
      size,
      type,
      parentId,
    } = body;

    // 3. Ownership verification (defense in depth)
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Validate required fields
    if (!name || !fileUrl || size == null || !type) {
      return NextResponse.json(
        { error: "Missing required file fields" },
        { status: 400 }
      );
    }

    // 5. Parent folder logic & path computation
    let path: string;
    if (parentId) {
      // Fetch parent folder record (ensure it's a folder, belongs to same user)
      const parentRecs = await db
        .select({
          id: files.id,
          path: files.path,
          isFolder: files.isFolder,
          userId: files.userId,
        })
        .from(files)
        .where(eq(files.id, parentId))
        .limit(1);

      if (parentRecs.length === 0) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 400 }
        );
      }
      const parent = parentRecs[0];

      // Ownership: ensure parent belongs to this user
      if (parent.userId !== userId) {
        return NextResponse.json(
          { error: "Cannot upload inside folder you don't own" },
          { status: 403 }
        );
      }

      // Ensure parent is a folder
      if (!parent.isFolder) {
        return NextResponse.json(
          { error: "Parent is not a folder" },
          { status: 400 }
        );
      }

      // Compose new path
      const parentPath = parent.path;
      // Normalize slashes: ensure exactly one slash between
      if (parentPath.endsWith("/")) {
        path = parentPath + name;
      } else {
        path = parentPath + "/" + name;
      }
    } else {
      // No parent, so root-level file
      path = "/" + name;
    }

    // 6. Name conflict check: in same parent folder, ensure no existing item with same name
    const conflictRecs = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.parentId, parentId ?? null), // parentId null or same parent
          // and same name, same user
          eq(files.name, name),
          eq(files.userId, userId)
        )
      )
      .limit(1);

    if (conflictRecs.length > 0) {
      return NextResponse.json(
        { error: "A file or folder with this name already exists in this folder" },
        { status: 409 } // Conflict
      );
    }

    // 7. Insert new file record
    const [newFile] = await db
      .insert(files)
      .values({
        name,
        path,
        fileUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        size,
        type,
        userId,
        parentId: parentId ?? null,
        isFolder: false,
        isStarred: false,
        isTrash: false,
      })
      .returning();

    // 8. Return inserted file info
    return NextResponse.json({ success: true, file: newFile });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
