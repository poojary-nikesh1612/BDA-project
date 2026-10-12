"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CloudSun, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DbSetupBanner } from "@/components/layout/db-setup-banner";

const registerFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(32, "Username must be at most 32 characters")
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Username can only contain letters, numbers, underscores, dots, and hyphens"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [dbSetupNeeded, setDbSetupNeeded] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    setDbSetupNeeded(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        if (
          data.code === "DB_NOT_CONFIGURED" ||
          data.code === "DB_CONNECTION_ERROR"
        ) {
          setDbSetupNeeded(data.error);
        } else {
          setServerError(data.error || "Registration failed.");
        }
        return;
      }

      router.push("/workspaces");
      router.refresh();
    } catch {
      setServerError("Network error occurred while creating your account.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 bg-grid-pattern flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>

        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-600/20 mb-3"
          >
            <CloudSun className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Create Your Account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set up your workspace to upload and analyze weather datasets
          </p>
        </div>

        {dbSetupNeeded && <DbSetupBanner message={dbSetupNeeded} />}

        <Card className="border-slate-200/90 shadow-lg shadow-slate-900/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Get Started</CardTitle>
            <CardDescription>
              Choose a unique username and a strong password (minimum 8
              characters).
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. alex_weather"
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-xs text-red-600">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
              <p className="text-center text-xs text-slate-600">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
