"use client";

import Link from "next/link";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useToast } from "@/hooks/use-toast"; // Use ShadCN Toast hook
import { Button } from "@/components/ui/button"; // ShadCN Button
import { Input } from "@/components/ui/input"; // ShadCN Input
import { Label } from "@/components/ui/label"; // ShadCN Label

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast(); // Use ShadCN Toast hook
    const [user, setUser] = React.useState({
        email: "",
        password: "",
        username: "",
    });
    const [buttonDisabled, setButtonDisabled] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const onSignup = async () => {
        try {
            setLoading(true);
            const response = await axios.post("/api/auth/signup", user);
            console.log("Signup success", response.data);

            toast({
                title: "Signup Successful",
                description: "You have successfully signed up!",
                variant: "default",
            });

            router.push("/auth/login");
        } catch (error: any) {
            console.error("Signup failed", error.message);

            toast({
                title: "Signup Failed",
                description: error.message || "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user.email && user.password && user.username) {
            setButtonDisabled(false);
        } else {
            setButtonDisabled(true);
        }
    }, [user]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <h1 className="text-2xl font-bold">{loading ? "Processing..." : "Signup"}</h1>
            <hr className="w-1/2 my-4 border-gray-300" />
            <div className="w-full max-w-md space-y-4">
                <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                        id="username"
                        type="text"
                        value={user.username}
                        onChange={(e) => setUser({ ...user, username: e.target.value })}
                        placeholder="Enter your username"
                    />
                </div>
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={user.email}
                        onChange={(e) => setUser({ ...user, email: e.target.value })}
                        placeholder="Enter your email"
                    />
                </div>
                <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        value={user.password}
                        onChange={(e) => setUser({ ...user, password: e.target.value })}
                        placeholder="Enter your password"
                    />
                </div>
                <Button
                    onClick={onSignup}
                    disabled={buttonDisabled || loading}
                    className="w-full"
                    variant={buttonDisabled || loading ? "ghost" : "default"}
                >
                    {buttonDisabled ? "Fill all fields" : loading ? "Signing up..." : "Signup"}
                </Button>
                <Link href="/auth/login" className="text-sm text-blue-500 hover:underline">
                    Visit login page
                </Link>
            </div>
        </div>
    );
}
