import { NextResponse } from "next/server";

export async function GET() {
  try {
    const guias = [
      {
        number: "2264673692",
        carrier: 21051,
      },
    ];

    const response = await fetch(
      "https://api.17track.net/track/v2/register",
      {
        method: "POST",
        headers: {
          "17token": process.env.TRACK17_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(guias),
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}