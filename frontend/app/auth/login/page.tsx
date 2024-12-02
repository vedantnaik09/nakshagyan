"use client";

import Link from "next/link";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useToast } from "@/hooks/use-toast"; // Import ShadCN Toast hook
import { Button } from "@/components/ui/button"; // Import ShadCN Button
import { Input } from "@/components/ui/input"; // Import ShadCN Input
import { Label } from "@/components/ui/label"; // Import ShadCN Label

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast(); // Use ShadCN Toast hook
    const [user, setUser] = React.useState({
        email: "",
        password: "",
    });
    const [buttonDisabled, setButtonDisabled] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const onLogin = async () => {
        try {
            setLoading(true);
            const response = await axios.post("/api/auth/login", user);
            console.log("Login success", response.data);

            toast({
                title: "Login Successful",
                description: "Welcome back!",
                variant: "default",
            });

            router.push("/auth/profile");
        } catch (error: any) {
            console.error("Login failed", error.message);

            toast({
                title: "Login Failed",
                description: error.message || "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user.email.length > 0 && user.password.length > 0) {
            setButtonDisabled(false);
        } else {
            setButtonDisabled(true);
        }
    }, [user]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <h1 className="text-2xl font-bold">{loading ? "Processing..." : "Login"}</h1>
            <hr className="w-1/2 my-4 border-gray-300" />
            <div className="w-full max-w-md space-y-4">
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
                    onClick={onLogin}
                    disabled={buttonDisabled || loading}
                    className="w-full"
                    variant={buttonDisabled || loading ? "ghost" : "default"}
                >
                    {buttonDisabled ? "Fill all fields" : loading ? "Logging in..." : "Login"}
                </Button>
                <Link href="/auth/signup" className="text-sm text-blue-500 hover:underline">
                    Visit Signup page
                </Link>
            </div>
        </div>
    );
}
