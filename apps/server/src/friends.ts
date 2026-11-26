/** Friends, challenges, blocking and reporting. No free-text messaging exists. */
import { randomBytes, randomInt } from 'node:crypto';
import { randomCode, type Bracket, type OnlineModeId, type ServerMessage } from '@lingua/shared';
import type { Hub } from './hub';
import type { MatchManager } from './matches';
import type { ServerStore } from './store/types';

interface Invite {
  id: string;
  from: string;
  to: string;
  mode: OnlineModeId;
  bracket: Bracket;
  expiresAt: number;
}

export class Friends {
  private invites = new Map<string, Invite>();

  constructor(
    private readonly hub: Hub,
    private readonly store: ServerStore,
    private readonly matches: MatchManager,
  ) {}

  static newFriendCode(): string {
    return randomCode(8, () => randomInt(0, 2 ** 31) / 2 ** 31);
  }

  async state(playerId: string): Promise<ServerMessage> {
    const nick = async (id: string) => (await this.store.getPlayer(id))?.nickname ?? 'Player';
    const friends = await this.store.listFriends(playerId);
    const reqs = await this.store.listFriendRequests(playerId);
    const blocked = await this.store.listBlocked(playerId);
    return {
      type: 'FRIENDS_STATE',
      friends: await Promise.all(friends.map(async (id) => ({ playerId: id, nickname: await nick(id), online: this.hub.isOnline(id) }))),
      incoming: await Promise.all(reqs.incoming.map(async (r) => ({ requestId: r.id, playerId: r.from, nickname: await nick(r.from) }))),
      outgoing: await Promise.all(reqs.outgoing.map(async (r) => ({ requestId: r.id, playerId: r.to, nickname: await nick(r.to) }))),
      blocked: await Promise.all(blocked.map(async (id) => ({ playerId: id, nickname: await nick(id) }))),
    };
  }

  async push(playerId: string): Promise<void> {
    if (this.hub.isOnline(playerId)) this.hub.send(playerId, await this.state(playerId));
  }

  /** Notifies a player's friends that their online status changed. */
  async presence(playerId: string): Promise<void> {
    for (const f of await this.store.listFriends(playerId)) await this.push(f);
  }

  async request(from: string, friendCode: string): Promise<string | null> {
    const target = await this.store.findByFriendCode(friendCode);
    if (!target || target.id === from) return 'NOT_FOUND';
    if (await this.store.isBlockedEitherWay(from, target.id)) return 'NOT_FOUND';
    if (await this.store.areFriends(from, target.id)) return null;
    // If the other player already asked us, accept immediately.
    const reverse = (await this.store.listFriendRequests(from)).incoming.find((r) => r.from === target.id);
    if (reverse) {
      await this.store.deleteFriendRequest(reverse.id);
      await this.store.addFriendship(from, target.id);
    } else {
      await this.store.addFriendRequest(from, target.id);
    }
    await this.push(from);
    await this.push(target.id);
    return null;
  }

  async respond(playerId: string, requestId: string, accept: boolean): Promise<string | null> {
    const req = await this.store.getFriendRequest(requestId);
    if (!req || req.to !== playerId) return 'FORBIDDEN';
    await this.store.deleteFriendRequest(requestId);
    if (accept) await this.store.addFriendship(req.from, req.to);
    await this.push(req.from);
    await this.push(req.to);
    return null;
  }

  async remove(playerId: string, other: string): Promise<void> {
    await this.store.removeFriendship(playerId, other);
    await this.push(playerId);
    await this.push(other);
  }

  async block(playerId: string, other: string): Promise<void> {
    if (playerId === other) return;
    await this.store.block(playerId, other);
    await this.store.removeFriendship(playerId, other);
    const reqs = await this.store.listFriendRequests(playerId);
    for (const r of [...reqs.incoming, ...reqs.outgoing]) if (r.from === other || r.to === other) await this.store.deleteFriendRequest(r.id);
    await this.push(playerId);
    await this.push(other);
  }

  async unblock(playerId: string, other: string): Promise<void> {
    await this.store.unblock(playerId, other);
    await this.push(playerId);
  }

  async report(playerId: string, other: string, reason: string, matchId?: string, details?: string): Promise<void> {
    if (playerId === other) return;
    await this.store.addReport({
      reporterId: playerId,
      reportedId: other,
      reason,
      ...(matchId ? { matchId } : {}),
      ...(details ? { details: details.slice(0, 500) } : {}),
      createdAt: Date.now(),
    });
  }

  async challenge(from: string, to: string, mode: OnlineModeId, bracket: Bracket): Promise<string | null> {
    if (!(await this.store.areFriends(from, to))) return 'FORBIDDEN';
    if (await this.store.isBlockedEitherWay(from, to)) return 'FORBIDDEN';
    if (!this.hub.isOnline(to)) return 'NOT_FOUND';
    if (this.matches.isBusy(to) || this.matches.isBusy(from)) return 'INVALID_STATE';
    for (const [id, inv] of this.invites) if (inv.expiresAt < Date.now()) this.invites.delete(id);
    const invite: Invite = { id: `inv_${randomBytes(8).toString('hex')}`, from, to, mode, bracket, expiresAt: Date.now() + 60_000 };
    this.invites.set(invite.id, invite);
    this.hub.send(to, { type: 'INVITE', inviteId: invite.id, from: this.hub.publicPlayer(from), mode, bracket, expiresAt: invite.expiresAt });
    return null;
  }

  async respondInvite(playerId: string, inviteId: string, accept: boolean): Promise<string | null> {
    const inv = this.invites.get(inviteId);
    if (!inv || inv.to !== playerId) return 'NOT_FOUND';
    this.invites.delete(inviteId);
    if (!accept || inv.expiresAt < Date.now()) return null;
    if (!this.hub.isOnline(inv.from) || this.matches.isBusy(inv.from)) return 'INVALID_STATE';
    await this.matches.create({ playerIds: [inv.from, inv.to], mode: inv.mode, queue: 'private', bracket: inv.bracket });
    return null;
  }
}
