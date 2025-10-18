import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { name, userId: bodyUserId, parentId = null } = body;

    // 3. Ownership verification
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Validate required fields
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // 5. Parent folder logic & path computation
    let parentPath = "/";
    if (parentId) {
      const parentRecs = await db
        .select({
          id: files.id,
          path: files.path,
          isFolder: files.isFolder,
          userId: files.userId,
        })
        .from(files)
        .where(
          and(
            eq(files.id, parentId),
            eq(files.userId, userId),
            eq(files.isFolder, true)
          )
        )
        .limit(1);

      if (parentRecs.length === 0) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }

      const parent = parentRecs[0];
      parentPath = parent.path.endsWith("/") ? parent.path : parent.path + "/";
    }

    const folderName = name.trim();
    const path = parentPath + folderName;

    // 6. Name conflict check within same parent
    const conflictRecs = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.parentId, parentId ?? null),
          eq(files.name, folderName),
          eq(files.userId, userId)
        )
      )
      .limit(1);

    if (conflictRecs.length > 0) {
      return NextResponse.json(
        {
          error:
            "A file or folder with this name already exists in this folder",
        },
        { status: 409 }
      );
    }

    // 7. Insert new folder record into database
    const [newFolder] = await db
      .insert(files)
      .values({
        id: uuidv4(),
        name: folderName,
        path,
        size: 0,
        type: "folder",
        fileUrl: "",
        thumbnailUrl: null,
        userId: userId,
        parentId: parentId ?? null,
        isFolder: true,
        isStarred: false,
        isTrash: false,
      })
      .returning();

    // 8. Return response
    return NextResponse.json({
      success: true,
      folder: newFolder,
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
