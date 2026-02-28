import { useState, useEffect, useRef } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  UserPlus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { FilterBarShell, PageHeroShell, PageSectionCard, StateBlock, TableShell } from "@/components/layout/page-shells";

type TeamMember = {
  id: string;
  kind: "user" | "invitation";
  userId?: number;
  invitationId?: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "invited" | "expired" | "disabled";
  avatar?: string;
  lastActive?: string;
  expiresAt?: string;
};

type BillingStatus = {
  isOwner?: boolean;
  plan: "free" | "standard" | "pro";
  planStatus: "active" | "trialing" | "past_due" | "canceled";
  trialEndsAt: string | null;
  entitlements: {
    seatLimit: number | null;
    integrationLimit: number | null;
    aiResponsesPerDay: number;
  };
  seatUsage: {
    memberCount: number;
    pendingInvitationCount: number;
    usedSeats: number;
    seatLimit: number | null;
  };
};

// Default roles data (static)
const defaultRoles: Role[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to all features and settings",
    iconColor: "red",
    permissions: [
      { id: "manage_team", name: "Manage team members", granted: true },
      { id: "configure_ai", name: "Configure AI settings", granted: true },
      { id: "manage_integrations", name: "Manage integrations", granted: true },
      { id: "access_billing", name: "Access billing & subscription", granted: true }
    ]
  },
  {
    id: "moderator",
    name: "Moderator",
    description: "Access to manage conversations and moderate content",
    iconColor: "blue",
    permissions: [
      { id: "access_conversations", name: "Access conversations", granted: true },
      { id: "perform_moderation", name: "Perform moderation actions", granted: true },
      { id: "edit_templates", name: "Edit response templates", granted: true },
      { id: "manage_team", name: "Manage team members", granted: false }
    ]
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to view data and analytics",
    iconColor: "gray",
    permissions: [
      { id: "view_conversations", name: "View conversations", granted: true },
      { id: "view_analytics", name: "View analytics", granted: true },
      { id: "perform_actions", name: "Perform actions", granted: false },
      { id: "edit_settings", name: "Edit settings", granted: false }
    ]
  }
];

// RolesAndPermissionsContent component
const RolesAndPermissionsContent = () => {
  // We're using static default roles instead of fetching from the API
  const roles = defaultRoles;

  return (
    <>
      {roles.map((role) => (
        <div key={role.id} className="border rounded-lg p-4">
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-medium">{role.name}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {role.permissions.map((permission) => (
              <div key={permission.id} className="flex items-center p-2 rounded-md bg-black text-white">
                {permission.granted ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mr-2" />
                )}
                {permission.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

const TeamSettingsContent = () => {
  const { toast } = useToast();
  // Fetch team settings from API
  const { data: teamSettings, isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['/api/team/settings'],
    queryFn: async () => {
      const response = await fetch('/api/team/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch team settings');
      }
      return await response.json();
    },
  });

  // State management for form values
  const [formState, setFormState] = useState({
    teamName: "",
    newMemberNotifications: true,
    criticalAlertNotifications: true,
    weeklyActivitySummary: true
  });

  // Update form state when API data is loaded
  useEffect(() => {
    if (teamSettings) {
      setFormState({
        teamName: teamSettings.name || "ModerateAI Team",
        newMemberNotifications: teamSettings.notificationSettings?.newMemberNotifications !== false,
        criticalAlertNotifications: teamSettings.notificationSettings?.criticalAlertNotifications !== false,
        weeklyActivitySummary: teamSettings.notificationSettings?.weeklyActivitySummary !== false
      });
    }
  }, [teamSettings]);

  // Update form API mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: typeof formState) => {
      const response = await fetch('/api/team/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update settings');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: `Team settings have been updated successfully`,
      });
      refetchSettings();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle save settings
  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(formState);
  };

  // Make form state available to parent component through a ref
  const formStateRef = useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Expose save handler to parent
  (TeamSettingsContent as any).handleSave = () => {
    handleSaveSettings();
  };

  if (isLoadingSettings) {
    return (
      <div className="space-y-6 py-2">
        <div className="space-y-3">
          <Skeleton className="h-6 w-44" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-52" />
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Team Information</h3>
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              placeholder="Your Team Name"
              value={formState.teamName}
              onChange={(e) => setFormState({...formState, teamName: e.target.value})}
            />
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
            <Switch 
              checked={formState.newMemberNotifications}
              onCheckedChange={(checked) => setFormState({...formState, newMemberNotifications: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Critical Alert Notifications</h4>
              <p className="text-sm text-gray-500">
                Notify on critical moderation events
              </p>
            </div>
            <Switch 
              checked={formState.criticalAlertNotifications}
              onCheckedChange={(checked) => setFormState({...formState, criticalAlertNotifications: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Weekly Activity Summary</h4>
              <p className="text-sm text-gray-500">
                Receive weekly email summaries
              </p>
            </div>
            <Switch 
              checked={formState.weeklyActivitySummary}
              onCheckedChange={(checked) => setFormState({...formState, weeklyActivitySummary: checked})}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Define a RolePermission type for better type-safety
type RolePermission = {
  id: string;
  name: string;
  granted: boolean;
};

// Define a Role type
type Role = {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  permissions: RolePermission[];
};

// Role customization feature removed

const Team = () => {
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isInviteLinkDialogOpen, setIsInviteLinkDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteData, setInviteData] = useState({
    email: "",
    role: "moderator",
  });

  // Fetch team members from the API
  const { data: teamMembers, isLoading: isLoadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ['/api/team/members'],
    queryFn: async () => {
      const response = await fetch('/api/team/members');
      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }
      return await response.json() as TeamMember[];
    },
  });

  const { data: billingStatus } = useQuery({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      const response = await fetch("/api/billing/status");
      if (!response.ok) {
        throw new Error("Failed to fetch billing status");
      }
      return (await response.json()) as BillingStatus;
    },
  });

  const seatLimit = billingStatus?.entitlements?.seatLimit ?? null;
  const usedSeats = billingStatus?.seatUsage?.usedSeats ?? 1;
  const isAtSeatLimit = seatLimit !== null && usedSeats >= seatLimit;

  // Get invitation link mutation
  const getInvitationLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/team/invite/${id}/link`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get invitation link');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setInviteLink(data.inviteLink);
      setIsInviteLinkDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get invitation link",
        variant: "destructive",
      });
    },
  });

  // Invite team member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402 && errorData?.code === "SEAT_LIMIT_REACHED") {
          throw new Error(
            errorData?.seatLimit
              ? `Seat limit reached (${errorData.usedSeats}/${errorData.seatLimit}). Upgrade to add more members.`
              : errorData.message || "Seat limit reached",
          );
        }
        throw new Error(errorData.message || 'Failed to create invitation');
      }
      
      const responseData = await response.json();
      return responseData;
    },
    onSuccess: (data) => {
      // Set the invitation link immediately so we can show it to the user
      setInviteLink(data.inviteLink);
      
      toast({
        title: "Invitation created",
        description: "Invitation link has been generated. Share it with your team member to join.",
        variant: "default",
        duration: 3000,
      });
      
      // Show the invitation link dialog immediately
      setIsInviteLinkDialogOpen(true);
      
      setIsInviteDialogOpen(false);
      setInviteData({ email: "", role: "moderator" });
      // Refresh the team members list to show the pending invitation
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      // Remove user from whitelist
      const response = await fetch(`/api/team/members/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove team member');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team member removed",
        description: `${selectedMember?.name} has been removed from your whitelist and can no longer access the system`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
      // Refresh the team members list
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await fetch(`/api/team/invite/${invitationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel invitation");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation cancelled",
        description: `${selectedMember?.email} can no longer join via that link.`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    },
  });

  const isRemovingMember = deleteMemberMutation.isPending || cancelInviteMutation.isPending;

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
    if (!selectedMember) return;

    if (selectedMember.kind === "invitation") {
      if (selectedMember.invitationId) {
        cancelInviteMutation.mutate(selectedMember.invitationId);
      }
      return;
    }

    if (selectedMember.userId) {
      deleteMemberMutation.mutate(selectedMember.userId);
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
      case "expired":
        return (
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-orange-500 mr-2"></span>
            Expired
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
    <div className="space-y-6 wave-v2-page wave-v2-team">
      <PageHeroShell>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Team Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage workspace members, roles, invitations, and team-level settings.
          </p>
        </div>
      </PageHeroShell>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="glass-chip h-auto flex-wrap gap-2 p-2">
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="settings">Team Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <PageSectionCard>
            <CardHeader>
              <CardTitle>Manage Team</CardTitle>
              <CardDescription>
                Whitelist and manage your team members who have access to ModerateAI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FilterBarShell className="mb-6">
                <div className="flex items-center justify-between gap-3">
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
                  <Button 
                    variant="outline" 
                    className="ml-4" 
                    onClick={() => refetchMembers()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </FilterBarShell>

              {isLoadingMembers ? (
                <div className="border rounded-md p-4 space-y-3">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2 min-w-0 flex-1">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-56 max-w-full" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />
                      <Skeleton className="h-6 w-20 rounded-full hidden md:block" />
                      <Skeleton className="h-4 w-24 hidden lg:block" />
                      <Skeleton className="h-8 w-20 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : filteredMembers && filteredMembers.length > 0 ? (
                <TableShell>
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
                              {member.kind === "invitation" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (member.invitationId) {
                                      getInvitationLinkMutation.mutate(member.invitationId);
                                    }
                                  }}
                                  disabled={!member.invitationId || member.status === "expired" || getInvitationLinkMutation.isPending}
                                >
                                  <Link className="h-4 w-4" />
                                </Button>
                              ) : (
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
                              )}
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
                </TableShell>
              ) : (
                <StateBlock
                  title="No team members found"
                  description={
                    searchQuery
                      ? "Try adjusting your search query"
                      : "Whitelist your first team member to get started"
                  }
                  icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
                  actions={
                    searchQuery ? (
                      <Button variant="outline" onClick={() => setSearchQuery("")}>
                        Clear search
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
            <CardFooter className="text-sm text-gray-500 flex justify-between items-center">
              <div className="space-y-1">
                <div>
                  {filteredMembers?.length || 0} team members
                  {searchQuery ? ` (filtered from ${teamMembers?.length || 0})` : ""}
                </div>
                {billingStatus && (
                  <div className="text-xs text-gray-500">
                    Seats: {usedSeats}/{seatLimit === null ? "Unlimited" : seatLimit} ({billingStatus.isOwner ? "Owner" : billingStatus.plan})
                  </div>
                )}
                {isAtSeatLimit && (
                  <div className="text-xs text-red-400">
                    Seat limit reached. Upgrade your plan to add more members.
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setIsInviteDialogOpen(true)}
                disabled={isAtSeatLimit}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Whitelist New Account
              </Button>
            </CardFooter>
          </PageSectionCard>


        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <PageSectionCard>
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>
                Configure what each role can access and modify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RolesAndPermissionsContent />
            </CardContent>
            {/* Removed Customize Roles button */}
          </PageSectionCard>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <PageSectionCard>
            <CardHeader>
              <CardTitle>Team Settings</CardTitle>
              <CardDescription>
                Configure team-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamSettingsContent />
            </CardContent>
            <CardFooter>
              <Button
                className="ml-auto"
                onClick={() => {
                  // Call the exposed handler
                  (TeamSettingsContent as any).handleSave();
                }}
              >
                Save Settings
              </Button>
            </CardFooter>
          </PageSectionCard>
        </TabsContent>
      </Tabs>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Whitelist New Account</DialogTitle>
            <DialogDescription>
              Add an email address to the whitelist. Users with whitelisted emails can access the system using just their email.
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
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Add to Whitelist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation Link Dialog */}
      <Dialog open={isInviteLinkDialogOpen} onOpenChange={setIsInviteLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Whitelisted Successfully</DialogTitle>
            <DialogDescription>
              The email has been added to your whitelist. The user can now access the system by signing in with their email.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 my-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Link className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm font-medium">Unique invitation link</div>
            </div>
            
            <div className="bg-secondary/20 p-3 rounded-lg border border-border overflow-hidden relative">
              <p className="text-sm break-all pr-10">{inviteLink}</p>
              <Button 
                size="sm" 
                variant="ghost"
                className="absolute right-1 top-1.5 h-8 w-8 p-0"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  toast({
                    title: "Link copied",
                    description: "Invitation link copied to clipboard",
                    duration: 2000,
                  });
                }}
              >
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
              <div className="flex gap-2 items-center mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Important</span>
              </div>
              <p>This link expires in 7 days and can only be used once. Anyone with this link can join your team with the selected role.</p>
            </div>
            
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  toast({
                    title: "Link copied",
                    description: "Invitation link copied to clipboard",
                    duration: 2000,
                  });
                }}
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setIsInviteLinkDialogOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
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
              {selectedMember?.kind === "invitation"
                ? "Cancel Invitation"
                : "Remove Team Member"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.kind === "invitation"
                ? `Are you sure you want to cancel the invitation to ${selectedMember?.email}?`
                : `Are you sure you want to remove ${selectedMember?.name} from your team? They will no longer have access to your ModerateAI account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isRemovingMember}
            >
              {isRemovingMember ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {selectedMember?.kind === "invitation"
                ? "Cancel Invitation"
                : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role customization feature removed */}
    </div>
  );
};

export default Team;

