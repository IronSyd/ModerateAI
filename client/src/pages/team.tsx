import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Mail,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Shield,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "invited" | "disabled";
  avatar?: string;
  lastActive?: string;
};

const Team = () => {
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteData, setInviteData] = useState({
    email: "",
    role: "moderator",
  });

  // Fetch team members - would use real API in production
  const { data: teamMembers, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['/api/team/members'],
    queryFn: async () => {
      // This is demo data since our backend doesn't have team members API yet
      return [
        {
          id: 1,
          name: "Demo User",
          email: "demo@example.com",
          role: "admin",
          status: "active",
          lastActive: "Just now",
        },
        {
          id: 2,
          name: "Alex Johnson",
          email: "alex@example.com",
          role: "moderator",
          status: "active",
          lastActive: "2 hours ago",
        },
        {
          id: 3,
          name: "Sarah Williams",
          email: "sarah@example.com",
          role: "viewer",
          status: "active",
          lastActive: "1 day ago",
        },
        {
          id: 4,
          name: "Miguel Lopez",
          email: "miguel@example.com",
          role: "moderator",
          status: "invited",
          lastActive: "N/A",
        },
      ] as TeamMember[];
    },
  });

  // Invite team member mutation - would connect to real API in production
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: `Invitation email sent to ${inviteData.email}`,
      });
      setIsInviteDialogOpen(false);
      setInviteData({ email: "", role: "moderator" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Team member removed",
        description: `${selectedMember?.name} has been removed from your team`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    },
  });

  // Handle invite form submission
  const handleInvite = () => {
    if (!inviteData.email) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    inviteMemberMutation.mutate(inviteData);
  };

  // Handle delete confirmation
  const handleDelete = () => {
    if (selectedMember) {
      deleteMemberMutation.mutate(selectedMember.id);
    }
  };

  // Filter team members by search query
  const filteredMembers = teamMembers?.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get role badge styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Moderator
          </Badge>
        );
      case "viewer":
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            Viewer
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            {role}
          </Badge>
        );
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
            Active
          </div>
        );
      case "invited":
        return (
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2"></span>
            Invited
          </div>
        );
      case "disabled":
        return (
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-gray-500 mr-2"></span>
            Disabled
          </div>
        );
      default:
        return (
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-gray-500 mr-2"></span>
            {status}
          </div>
        );
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div></div> {/* Empty div to maintain the flex layout */}
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Team Member
        </Button>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="settings">Team Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage Team</CardTitle>
              <CardDescription>
                Invite and manage your team members who have access to ModerateAI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search by name or email..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="ml-4">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredMembers && filteredMembers.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-3">
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback className="bg-primary-100 text-primary-800">
                                  {member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-gray-500">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(member.role)}</TableCell>
                          <TableCell>{getStatusBadge(member.status)}</TableCell>
                          <TableCell className="text-gray-500">
                            {member.lastActive || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Would open edit dialog in a real app
                                  toast({
                                    title: "Edit member",
                                    description: `Editing ${member.name}`,
                                  });
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsDeleteDialogOpen(true);
                                }}
                                disabled={member.role === "admin"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-4 text-lg font-medium">
                    No team members found
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "Invite your first team member to get started"}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setSearchQuery("")}
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="text-sm text-gray-500 flex justify-between items-center">
              <div>
                {filteredMembers?.length || 0} team members
                {searchQuery
                  ? ` (filtered from ${teamMembers?.length || 0})`
                  : ""}
              </div>
              {teamMembers && teamMembers.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                These are invitations that have been sent but not yet accepted
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredMembers && filteredMembers.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers
                        .filter((member) => member.status === "invited")
                        .map((member) => (
                          <TableRow key={`invitation-${member.id}`}>
                            <TableCell className="font-medium">
                              {member.email}
                            </TableCell>
                            <TableCell>{getRoleBadge(member.role)}</TableCell>
                            <TableCell className="text-gray-500">
                              2 days ago
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    toast({
                                      title: "Invitation resent",
                                      description: `Invitation to ${member.email} has been resent`,
                                    });
                                  }}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    No pending invitations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>
                Configure what each role can access and modify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <div className="h-8 w-8 rounded-full bg-red-100 mr-3 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-red-800" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Admin</h3>
                    <p className="text-sm text-gray-500">
                      Full access to all features and settings
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Manage team members
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Configure AI settings
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Manage integrations
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Access billing & subscription
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <div className="h-8 w-8 rounded-full bg-blue-100 mr-3 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-blue-800" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Moderator</h3>
                    <p className="text-sm text-gray-500">
                      Can manage conversations and perform moderation actions
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Access conversations
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Perform moderation actions
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    Edit response templates
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                    Manage team members
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <div className="h-8 w-8 rounded-full bg-gray-100 mr-3 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-gray-800" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Viewer</h3>
                    <p className="text-sm text-gray-500">
                      Read-only access to view data and analytics
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    View conversations
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                    View analytics
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                    Perform actions
                  </div>
                  <div className="flex items-center p-2 rounded-md bg-gray-50">
                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                    Edit settings
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="ml-auto">
                Customize Roles
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Settings</CardTitle>
              <CardDescription>
                Configure team-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Team Information</h3>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team Name</Label>
                    <Input
                      id="teamName"
                      placeholder="Your Team Name"
                      defaultValue="Demo Team"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium">Security Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                      <h4 className="font-medium">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-500">
                        Require 2FA for all team members
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                      <h4 className="font-medium">Session Timeout</h4>
                      <p className="text-sm text-gray-500">
                        Automatically log out after inactivity
                      </p>
                    </div>
                    <Select defaultValue="60">
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium">Notification Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        New Team Member Notifications
                      </h4>
                      <p className="text-sm text-gray-500">
                        Notify when someone joins your team
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Critical Alert Notifications</h4>
                      <p className="text-sm text-gray-500">
                        Notify on critical moderation events
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Weekly Activity Summary</h4>
                      <p className="text-sm text-gray-500">
                        Receive weekly email summaries
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="ml-auto"
                onClick={() => {
                  toast({
                    title: "Settings saved",
                    description: "Your team settings have been updated",
                  });
                }}
              >
                Save Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Invite a new member to your team. They'll receive an email with
              instructions to join.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                className="col-span-3"
                value={inviteData.email}
                onChange={(e) =>
                  setInviteData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                value={inviteData.role}
                onValueChange={(value) =>
                  setInviteData((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviteMemberMutation.isPending}
            >
              {inviteMemberMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedMember?.status === "invited"
                ? "Cancel Invitation"
                : "Remove Team Member"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.status === "invited"
                ? `Are you sure you want to cancel the invitation to ${selectedMember?.email}?`
                : `Are you sure you want to remove ${selectedMember?.name} from your team? They will no longer have access to your ModerateAI account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMemberMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {selectedMember?.status === "invited"
                ? "Cancel Invitation"
                : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Team;