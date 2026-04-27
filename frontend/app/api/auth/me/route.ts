import { getDataFromToken } from "../../../../helpers/getDataFromToken";
import { NextRequest, NextResponse } from "next/server";
import User from "../../../models/userModel";
import { connect } from "../../../dbConfig/dbConfig";

let isConnected = false

export async function GET(request:NextRequest){
    if (!isConnected) {
        await connect()
        isConnected = true
    }

    try {
        const userId = await getDataFromToken(request);
        const user = await User.findOne({_id: userId}).select("-password");
        return NextResponse.json({
            mesaaage: "User found",
            data: user
        })
    } catch (error:any) {
        return NextResponse.json({error: error.message}, {status: 400});
    }

}