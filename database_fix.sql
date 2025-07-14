-- Fix the RLS policy to allow all authenticated users to view all customers
-- This is the key change needed to solve the visibility issue

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own customers and admins can view all" ON customers;

-- Create a new policy that allows all authenticated users to view all customers
CREATE POLICY "All authenticated users can view all customers" ON customers
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep the existing policies for insert, update, and delete (these are correct)
-- Users can still only edit/delete their own customers (or admins can edit/delete all)

-- Also ensure user_profiles has a policy that allows reading other users' profiles
-- This is needed to show creator names
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Allow all authenticated users to view all user profiles (for displaying creator names)
CREATE POLICY "All authenticated users can view all profiles" ON user_profiles
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep the existing policies for update and insert on user_profiles
-- Users can still only update their own profiles 