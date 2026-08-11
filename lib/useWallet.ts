"use client";

import { useSyncExternalStore } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from "wagmi";

import {
  CHAIN_ID,
  ERC20_BALANCE_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from "./chain";

const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // Wallet state only exists in the browser; render a neutral shell until the
  // client has mounted so the server and client markup agree.
  const mounted = useSyncExternalStore(noopSubscribe, onClient, onServer);

  const onRightChain = chainId === CHAIN_ID;

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: Boolean(address),
      refetchInterval: 20_000,
    },
  });

  const raw = balance.data as bigint | undefined;
  const usdc = raw === undefined ? null : Number(raw) / 10 ** USDC_DECIMALS;

  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return {
    mounted,
    address,
    isConnected: mounted && isConnected,
    onRightChain,
    chainId,
    connect: () => injected && connect({ connector: injected }),
    hasConnector: Boolean(injected),
    isConnecting,
    connectError: error,
    disconnect,
    switchToBaseSepolia: () => switchChain({ chainId: CHAIN_ID }),
    isSwitching,
    usdc,
    isBalanceLoading: balance.isLoading,
    balanceError: balance.isError,
    refetchBalance: balance.refetch,
  };
}
