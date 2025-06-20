import { NextResponse } from 'next/server';
import { Connection} from '@solana/web3.js'
import { DriftClient, Wallet, loadKeypair, PerpMarkets, PerpMarketConfig } from '@drift-labs/sdk';


interface EnhancedMarketData {
  symbol: string;
  price: number;
  volume24h: number;
  openInterest: number;
}

export async function GET() {
  console.log('Starting GET request to /api/drift-data');
  try {

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
    console.log('RPC URL:', rpcUrl);
    const connection = new Connection(rpcUrl);
    console.log(`Solana ${connection.rpcEndpoint} connection established successfully`);


    const keypairFile = process.env.NEXT_PUBLIC_KEYPAIR;
    console.log('Keypair file path:', keypairFile);
    if (!keypairFile) {
      throw new Error('Keypair path not found in environment variables');
    }


    console.log('Loading keypair...');
    const wallet = new Wallet(loadKeypair(keypairFile));
    console.log('Wallet created successfully with public key:', wallet.publicKey.toString());

    console.log('Initializing Drift client...');
    const driftClient = new DriftClient({
      connection,
      wallet,
      env: 'devnet',
    });
    console.log('Drift client initialized successfully');

   
    console.log('Subscribing to Drift client...');
    await driftClient.subscribe();
    console.log('Drift client subscribed successfully');

    console.log('Fetching enhanced perpetual market data...');
    const enhancedMarketData: EnhancedMarketData[] = await Promise.all(
      PerpMarkets['devnet'].map(async (market: PerpMarketConfig) => {
        const perpMarket = driftClient.getPerpMarketAccount(market.marketIndex);
        const price = perpMarket ? perpMarket.amm.historicalOracleData.lastOraclePriceTwap.toNumber() : 0;
        const volume24h = perpMarket ? perpMarket.amm.volume24H.toNumber() : 0;
        const openInterest = perpMarket ? perpMarket.amm.baseAssetAmountWithAmm.toNumber() : 0;

        return {
          symbol: market.symbol,
          price: price / 1e6, // Convert to standard units
          volume24h: volume24h / 1e6, 
          openInterest: openInterest / 1e9, 
        };
      })
    );
    console.log('Fetched enhanced market data:', enhancedMarketData);

    return NextResponse.json({ markets: enhancedMarketData });
  } catch (error) {
    console.error('Error fetching Drift data:', error);
    return NextResponse.json({ error: 'Failed to fetch Drift data' }, { status: 500 });
  }
}