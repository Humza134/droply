import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUploadAuthParams } from "@imagekit/next/server"

export async function GET() {
    try {
        // check authentication
        const {userId} = await auth();
        if(!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Your application logic to authenticate the user
        // For example, you can check if the user is logged in or has the necessary permissions
        // If the user is not authenticated, you can return an error response
    
        // const { token, expire, signature } = getUploadAuthParams({
        // instead of destructuring, you can pass the options directly
        const authenticationParameters = getUploadAuthParams({
            privateKey: process.env.NEXT_PRIVATE_IMAGEKIT_PRIVATE_KEY as string, // Never expose this on client side
            publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY as string,
            // expire: 30 * 60, // Optional, controls the expiry time of the token in seconds, maximum 1 hour in the future
            // token: "random-token", // Optional, a unique token for request
        })
    
        return Response.json({
            token: authenticationParameters.token,
            expire: authenticationParameters.expire,
            signature: authenticationParameters.signature,
            publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
        });
    } catch (error) {
        return Response.json({
            error: "Authentication for Imagekit is failed"
        }, {status: 500})
    }
}