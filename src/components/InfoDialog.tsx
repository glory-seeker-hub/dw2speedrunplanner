import { Info, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import glorySeekerImage from '@/assets/glory-seeker.jpg';

export const InfoDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="About this application" className="h-10 w-10">
          <Info className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">About This Application</DialogTitle>
          <DialogDescription>
            Information about the Digimon World 2 Battle Simulator
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="how-to" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="how-to">How to Use</TabsTrigger>
            <TabsTrigger value="mechanics">Battle Mechanics</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
          </TabsList>

          <TabsContent value="how-to" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">1. Build Your Team</h3>
                  <p className="text-sm text-muted-foreground">
                    In the Team Builder tab, select up to 3 Digimon for your team. Customize their stats (HP, MP, ATK, DEF, SPD) and choose their techs (abilities).
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. Run Battle Simulations</h3>
                  <p className="text-sm text-muted-foreground">
                    Navigate to the Battle Simulation tab. Select your saved team, choose an enemy team (encounter or saved team), set the floor specialty, and configure the number of simulations to run.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. Analyze Results</h3>
                  <p className="text-sm text-muted-foreground">
                    After simulations complete, view detailed statistics including win rate, average turns, fastest/slowest battles, and a complete battle history in the Results tab.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mechanics" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">Implemented Mechanics</h3>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li><strong>Turn Order:</strong> Based on SPD stat with random initiative</li>
                    <li><strong>Counter Mechanics:</strong> Counter techs can be triggered when attacked</li>
                    <li><strong>Counter Chains:</strong> Counters cannot trigger other counters</li>
                    <li><strong>Interrupts:</strong> Treated as normal attacks in the turn order</li>
                    <li><strong>Debuff Effects:</strong> ATK/DEF/SPD down effects stack up to 2 times</li>
                    <li><strong>Type/Specialty Bonuses:</strong> Damage calculation includes type advantages and specialty bonuses</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Special Tech Effects</h3>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li><strong>Shadow Scythe:</strong> Chains to another target on kill</li>
                    <li><strong>Twig Tap:</strong> Heals HP equal to damage dealt</li>
                    <li><strong>SubZero Ice Punch:</strong> AP increases by 2.5 when used consecutively (up to 10 times)</li>
                    <li><strong>Howling Crusher:</strong> Does not trigger enemy counters</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Not Implemented</h3>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li>Assist mechanics</li>
                    <li>Status effects (paralysis, confusion, poison, etc.)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credits" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-48 h-auto rounded-lg overflow-hidden shadow-lg">
                    <img 
                      src={glorySeekerImage} 
                      alt="Glory Seeker" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold">Created by GlorySeeker</h3>
                    <p className="text-sm text-muted-foreground">
                      Digimon World 2 enthusiast and content creator
                    </p>
                    <a
                      href="https://www.twitch.tv/glory_seeker"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      twitch.tv/glory_seeker
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
