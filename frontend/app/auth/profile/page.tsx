"use client";

import axios from "axios";
import Link from "next/link";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast"; // Use ShadCN Toast hook
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"; // ShadCN Button
import { Card } from "@/components/ui/card"; // Optional ShadCN Card Component for cleaner UI
import { Label } from "@/components/ui/label"; // Optional ShadCN Label Component

export default function ProfilePage() {
    const router = useRouter();
    const { toast } = useToast(); // ShadCN Toast hook
    const [data, setData] = useState("nothing");

    const logout = async () => {
        try {
            await axios.get("/api/auth/logout");
            toast({
                title: "Logout Successful",
                description: "You have been logged out.",
                variant: "default",
            });
            router.push("/auth/login");
        } catch (error: any) {
            console.error(error.message);
            toast({
                title: "Logout Failed",
                description: error.message || "Something went wrong.",
                variant: "destructive",
            });
        }
    };

    const getUserDetails = async () => {
        try {
            const res = await axios.get("/api/auth/me");
            console.log(res.data);
            setData(res.data.data._id);

            toast({
                title: "User Details Fetched",
                description: `User ID: ${res.data.data._id}`,
                variant: "default",
            });
        } catch (error: any) {
            console.error(error.message);
            toast({
                title: "Error Fetching User Details",
                description: error.message || "Something went wrong.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <Card className="w-full max-w-md p-6">
                <h1 className="text-2xl font-bold mb-4">Profile</h1>
                <hr className="my-4" />
                <p className="text-gray-600">Welcome to your profile page!</p>

                <div className="mt-6">
                    <Label className="mb-2 block">User ID:</Label>
                    <h2 className="p-2 rounded bg-green-500 text-white">
                        {data === "nothing" ? (
                            "No User ID"
                        ) : (
                            <Link href={`/auth/profile/${data}`} className="hover:underline">
                                {data}
                            </Link>
                        )}
                    </h2>
                </div>

                <hr className="my-6" />

                <Button
                    onClick={logout}
                    variant="default"
                    className="w-full mb-4 bg-blue-500 hover:bg-blue-700"
                >
                    Logout
                </Button>

                <Button
                    onClick={getUserDetails}
                    variant="default"
                    className="w-full bg-green-800 hover:bg-green-600"
                >
                    Get User Details
                </Button>
            </Card>
        </div>
    );
}
